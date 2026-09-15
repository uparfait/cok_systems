const { evaluate_rule, build_trimmed_evaluation_data } = require("../jsonlogic/engine.js");
const { effective_rule_condition } = require("../jsonlogic/validation_condition.js");
const { flatten_fields, build_field_parent_map, is_visible_through_ancestors } = require("../jsonlogic/dependency_graph.js");
const { resolve_preset_value, apply_presets } = require("../jsonlogic/preset_fields.js");
const { location_tree, PROVINCE_TRANSLATIONS } = require("../controllers/locations/get_locations.js");

// Field types that never hold a respondent answer - nothing to generate.
const NON_ANSWER_TYPES = new Set(["paragraph", "header", "file", "image_block", "horizontal_line", "section", "group"]);
const MEDIA_TYPES = new Set(["image", "video", "audio", "file_upload"]);
const PARENT_GROUP_CAPABLE_TYPES = ["single_select", "multi_select", "select_group"];

const WORD_BANK = [
  "market", "school", "water", "road", "health", "family", "house", "farm", "community", "service",
  "report", "visit", "meeting", "training", "support", "project", "record", "office", "district", "village",
  "garden", "harvest", "supply", "center", "bridge", "clinic", "teacher", "student", "worker", "citizen",
];

const PHONE_PREFIXES = ["078", "072", "073", "079"];

// Every media type gets a REAL random link with a matching extension in its
// name, so the answer displays like a genuine upload and passes the media
// validation (a link answer is accepted as-is; the extension-bearing name
// keeps it honest with the field's allowed types either way).
const MEDIA_SAMPLES = {
  image: { extension: "jpg", url: (seed) => `https://picsum.photos/seed/${seed}/640/480` },
  signature: { extension: "png", url: (seed) => `https://picsum.photos/seed/sig-${seed}/400/160` },
  video: { extension: "mp4", url: () => "https://www.w3schools.com/html/mov_bbb.mp4" },
  audio: { extension: "mp3", url: () => "https://www.w3schools.com/html/horse.mp3" },
  file_upload: { extension: "pdf", url: () => "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" },
};

function generate_media_candidate(field) {
  const seed = Math.random().toString(36).slice(2, 10);
  const sample = MEDIA_SAMPLES[field.type] || MEDIA_SAMPLES.image;
  return { is_link: true, name: `test-${field.type}-${seed}.${sample.extension}`, url: sample.url(seed) };
}

const GEO_PROVINCES = ["Umujyi wa Kigali", "Amajyaruguru", "Amajyepfo", "Iburasirazuba", "Iburengerazuba"];

function random_int(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick_random(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function random_words(count) {
  const words = [];
  for (let index = 0; index < count; index += 1) words.push(pick_random(WORD_BANK));
  return words.join(" ");
}

function pad_two(value) {
  return String(value).padStart(2, "0");
}

function format_date(date) {
  return `${date.getFullYear()}-${pad_two(date.getMonth() + 1)}-${pad_two(date.getDate())}`;
}

function format_date_time(date) {
  return `${format_date(date)}T${pad_two(date.getHours())}:${pad_two(date.getMinutes())}`;
}

/**
 * Random date within the field's own min_date/max_date bounds when set,
 * otherwise within the past year - shifted off a weekend when the field
 * excludes weekends.
 */
function random_date_within(field) {
  const now = Date.now();
  const min = field.min_date ? new Date(field.min_date).getTime() : now - 365 * 24 * 3600 * 1000;
  const max = field.max_date ? new Date(field.max_date).getTime() : now;
  const lower = Number.isFinite(min) ? min : now - 365 * 24 * 3600 * 1000;
  const upper = Number.isFinite(max) && max > lower ? max : lower + 24 * 3600 * 1000;
  let date = new Date(lower + Math.random() * (upper - lower));
  if (field.exclude_weekends) {
    for (let guard = 0; guard < 7 && (date.getDay() === 0 || date.getDay() === 6); guard += 1) {
      const shifted = date.getTime() - 24 * 3600 * 1000;
      date = new Date(shifted >= lower ? shifted : date.getTime() + 24 * 3600 * 1000);
    }
  }
  return date;
}

// Mirrors evaluate_parent_group_condition in jsonlogic/validate_submission.js
// (and the frontend's fieldText.js) - keep all in sync.
function evaluate_parent_group_condition(operator, actual_value, expected_value) {
  switch (operator) {
    case "not_equals":
      return Array.isArray(actual_value) ? !actual_value.includes(expected_value) : actual_value !== expected_value;
    case "includes":
      return Array.isArray(actual_value)
        ? actual_value.includes(expected_value)
        : String(actual_value ?? "").toLowerCase().includes(String(expected_value ?? "").toLowerCase());
    case "not_includes":
      return !evaluate_parent_group_condition("includes", actual_value, expected_value);
    case "less_than":
      return Number(actual_value) < Number(expected_value);
    case "greater_than":
      return Number(actual_value) > Number(expected_value);
    case "equals":
    default:
      return Array.isArray(actual_value) ? actual_value.includes(expected_value) : actual_value === expected_value;
  }
}

function has_real_answer(value) {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function field_is_visible(field, data) {
  if (!field.visibility_condition) return true;
  const result = evaluate_rule(field.visibility_condition, build_trimmed_evaluation_data(data));
  return result.error ? true : result.value !== false;
}

function is_locked_by_parent_groups(field, data) {
  if (!PARENT_GROUP_CAPABLE_TYPES.includes(field.type) || !field.parent_dependency_enabled) return false;
  const groups = field.parent_option_groups || [];
  return !groups.some((group) => {
    if (!group || !group.parent_field_id) return false;
    const actual_value = data[group.parent_field_id];
    if (!has_real_answer(actual_value)) return false;
    return evaluate_parent_group_condition(group.operator || "equals", actual_value, group.value);
  });
}

/**
 * The real options a select-family field currently offers, given the rest
 * of the generated answers so far - matching parent_option_groups for a
 * parent-dependent select_group, options tagged with the parent's exact
 * answer for a cascading_select, and the flat options list otherwise.
 * This is what makes generated cascades coherent: a child value is only
 * ever picked from the options its generated parent answer actually allows.
 */
function available_options(field, data) {
  if (field.type === "cascading_select") {
    const all_options = field.options || [];
    if (!field.parent_field_id) return all_options;
    const parent_value = data[field.parent_field_id];
    if (!has_real_answer(parent_value)) return [];
    const trimmed_parent = typeof parent_value === "string" ? parent_value.trim() : parent_value;
    return all_options.filter((option) => option.parent_value === trimmed_parent);
  }
  if (field.type === "select_group" && field.parent_dependency_enabled) {
    const matching = [];
    (field.parent_option_groups || []).forEach((group) => {
      if (!group || !group.parent_field_id) return;
      const actual_value = data[group.parent_field_id];
      if (!has_real_answer(actual_value)) return;
      if (evaluate_parent_group_condition(group.operator || "equals", actual_value, group.value)) {
        matching.push(...(group.options || []));
      }
    });
    return matching;
  }
  return field.options || [];
}

function usable_option_values(field, data) {
  return available_options(field, data)
    .map((option) => option.value)
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

// ---- API-sourced location cascades ----------------------------------------
// A cascading_select with data_source.type === "api" carries no options of
// its own: the respondent's choices come from the country location tree
// (see controllers/locations/get_locations.js and the frontend's
// CascadingSelectField/filterLocations), filtered by the ancestor answers,
// and the stored value is the picked location's NAME. The generator walks
// the exact same tree the same way, so generated location answers are
// always real places that respect the whole cascade.

const LOCATION_LEVELS_ORDER = ["provinces", "districts", "sectors", "cells", "villages"];
const LOCATION_CHILD_KEYS = ["districts", "sectors", "cells", "villages"];

function normalize_name(value) {
  return String(value || "").toLowerCase().trim();
}

// Mirrors findMatch in the frontend's filterLocations: a stored value can be
// a province's raw name or any of its translations.
function find_location_match(items, value) {
  const search = normalize_name(value);
  if (!search) return null;
  return (items || []).find((item) => {
    const item_name = typeof item === "string" ? item : item.name;
    if (normalize_name(item_name) === search) return true;
    const translations = (typeof item === "object" && item && item.translations) || PROVINCE_TRANSLATIONS[item_name];
    return translations ? Object.values(translations).some((entry) => normalize_name(entry) === search) : false;
  });
}

function locations_at_level(level, path) {
  const country = location_tree && location_tree.Rwanda;
  if (!country) return [];
  let items = country.provinces || [];
  const depth = LOCATION_LEVELS_ORDER.indexOf(level);
  for (let index = 0; index < depth; index += 1) {
    const match = find_location_match(items, path[index]);
    if (!match || typeof match === "string") return [];
    items = match[LOCATION_CHILD_KEYS[index]] || [];
  }
  return items;
}

/**
 * A coherent random value for one api-sourced location field: the ancestor
 * fields' already-generated answers form the trail (province, district, ...)
 * exactly like the live renderer's buildPath, and the pick comes only from
 * that trail's own children. undefined while an ancestor is still
 * unanswered - the respondent would see nothing for this field either.
 */
function generate_api_location_candidate(field, data, fields_by_id) {
  const level = (field.data_source && field.data_source.level) || "provinces";
  const path = [];
  let current_id = field.parent_field_id;
  while (current_id) {
    const parent = fields_by_id.get(current_id);
    if (!parent) break;
    const parent_value = data[current_id];
    if (!has_real_answer(parent_value)) return undefined;
    path.unshift(String(parent_value));
    current_id = parent.parent_field_id;
  }
  const items = locations_at_level(level, path);
  if (items.length === 0) return undefined;
  const picked = pick_random(items);
  return typeof picked === "string" ? picked : picked.name;
}

// Progressively wider ranges tried across candidate attempts, so a rule
// like "must be between 1 and 5" or "must be above 100" eventually gets a
// passing sample without parsing the rule itself.
const NUMBER_RANGES = [
  [1, 10],
  [0, 100],
  [1, 5],
  [10, 1000],
  [18, 80],
  [0, 30],
];

/**
 * One random candidate value for a field, appropriate to its type. Returns
 * undefined when the field cannot be answered right now (no matching
 * options yet, or a type with nothing to generate).
 */
function generate_candidate(field, data, attempt, fields_by_id) {
  // A preset field is never random: it always carries its configured
  // default, so every generated record respects it exactly like a real one.
  const preset = resolve_preset_value(field, data);
  if (preset.has) return preset.value;
  if (field.type === "cascading_select" && field.data_source && field.data_source.type === "api") {
    return generate_api_location_candidate(field, data, fields_by_id);
  }
  switch (field.type) {
    case "text": {
      // Later attempts vary the shape so a custom rule (length bounds, must
      // contain a number, ...) eventually meets a passing sample.
      if (attempt > 12) return `${random_words(2)} ${random_int(1, 99)}`;
      if (attempt > 6) return random_words(random_int(3, 6));
      return random_words(random_int(1, 3));
    }
    case "large_text":
      return random_words(random_int(6, 18));
    case "number": {
      const range = NUMBER_RANGES[(attempt + random_int(0, 2)) % NUMBER_RANGES.length];
      return String(random_int(range[0], range[1]));
    }
    case "email":
      return `test.${Math.random().toString(36).slice(2, 8)}@example.com`;
    case "url":
      return `https://example.com/${Math.random().toString(36).slice(2, 8)}`;
    case "phone": {
      let digits = "";
      for (let index = 0; index < 7; index += 1) digits += String(random_int(0, 9));
      return `${pick_random(PHONE_PREFIXES)}${digits}`;
    }
    case "single_select":
    case "select_group":
    case "cascading_select": {
      const values = usable_option_values(field, data);
      return values.length > 0 ? pick_random(values) : undefined;
    }
    case "multi_select": {
      const values = usable_option_values(field, data);
      if (values.length === 0) return undefined;
      const count = random_int(1, Math.min(3, values.length));
      const shuffled = values.slice().sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    }
    case "likert_scale":
      return random_int(1, field.scale_size || 5);
    case "ranking": {
      const values = (field.options || []).map((option) => option.value).filter((value) => has_real_answer(value));
      return values.length > 0 ? values.slice().sort(() => Math.random() - 0.5) : undefined;
    }
    case "date":
      return format_date(random_date_within(field));
    case "date_time":
      return format_date_time(random_date_within(field));
    case "time":
      return `${pad_two(random_int(0, 23))}:${pad_two(random_int(0, 59))}`;
    case "duration":
      return { hours: String(random_int(0, 12)), minutes: String(random_int(0, 59)) };
    case "geolocation":
      // The full shape the street-map field stores: random coordinates
      // inside Rwanda plus random address details, exactly like a real
      // picked point after reverse geocoding.
      return {
        latitude: -(1.3 + Math.random() * 1.5),
        longitude: 28.9 + Math.random() * 1.9,
        accuracy: random_int(3, 40),
        province: pick_random(GEO_PROVINCES),
        district: random_words(1),
        sector: random_words(1),
        cell: random_words(1),
        village: random_words(1),
        street: `KN ${random_int(1, 250)} St`,
        full_address: `${random_words(2)}, ${pick_random(GEO_PROVINCES)}, Rwanda`,
      };
    case "signature":
      // A link-style value is the only shape a generator can produce without
      // a real uploaded file behind it; validate_media_answer accepts it.
      return generate_media_candidate(field);
    case "hidden":
      return field.default_value !== undefined && field.default_value !== null ? field.default_value : undefined;
    default:
      // Media fields ALWAYS get a random link answer, optional or not - a
      // skipped photo used to fail any rule that expected one.
      if (MEDIA_TYPES.has(field.type)) return generate_media_candidate(field);
      return undefined;
  }
}

/**
 * True when every error-severity validation rule of this one field passes
 * against the data as it currently stands (warnings never block). Mirrors
 * validate_submission_data: a value rule is skipped while the field holds
 * no answer - only depends_on_parent (the conditional-requirement rule)
 * evaluates against an empty field.
 */
function passes_own_rules(field, data) {
  const trimmed = build_trimmed_evaluation_data(data);
  const answered = has_real_answer(data[field.id]);
  return (field.validation_rules || []).every((rule) => {
    const condition = effective_rule_condition(field, rule);
    if (!condition) return true;
    if (rule.severity === "warning") return true;
    if (!answered && rule.operator && rule.operator !== "depends_on_parent") return true;
    const result = evaluate_rule(condition, trimmed);
    return result.error ? false : result.value !== false;
  });
}

/**
 * Generates one full random submission data object for a form schema:
 * fields are answered in document order across a few passes (so a parent's
 * value exists before its dependents pick from it), visibility conditions
 * and parent-group locks decide what gets answered at all, computed fields
 * are refreshed between passes, and each field's own validation rules are
 * retried against fresh candidates. The result is a best effort - the
 * caller still runs it through validate_submission_data exactly like a real
 * submit and discards it when it does not pass.
 */
function generate_test_record(schema) {
  const flat_fields = flatten_fields(schema.fields || []);
  const parent_map = build_field_parent_map(schema.fields || []);
  const fields_by_id = new Map(flat_fields.map((field) => [field.id, field]));
  const data = {};

  for (let pass = 0; pass < 3; pass += 1) {
    flat_fields.forEach((field) => {
      if (field && field.computed && field.computed.enabled && field.computed.formula) {
        const computed_result = evaluate_rule(field.computed.formula, build_trimmed_evaluation_data(data));
        data[field.id] = computed_result.value;
      }
    });

    const own_visible = new Map(flat_fields.map((field) => [field.id, field_is_visible(field, data)]));

    // Presets first, so children generated in this pass pick under them.
    apply_presets(schema.fields || [], data);

    flat_fields.forEach((field) => {
      if (!field || !field.type || NON_ANSWER_TYPES.has(field.type)) return;
      if (field.computed && field.computed.enabled && field.computed.formula) return;
      if (has_real_answer(data[field.id])) return;
      if (!own_visible.get(field.id) || !is_visible_through_ancestors(field.id, parent_map, own_visible)) return;
      if (is_locked_by_parent_groups(field, data)) return;

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const candidate = generate_candidate(field, data, attempt, fields_by_id);
        if (candidate === undefined) break;
        data[field.id] = candidate;
        if (passes_own_rules(field, data)) break;
        if (attempt === 19 && !field.mandatory) delete data[field.id];
      }
    });
  }

  return data;
}

module.exports = {
  generate_test_record,
  locations_at_level,
  find_location_match,
  LOCATION_LEVELS_ORDER,
};
