const { evaluate_rule, build_trimmed_evaluation_data, trim_value } = require("../jsonlogic/engine.js");
const { effective_rule_condition } = require("../jsonlogic/validation_condition.js");
const { is_visible_through_ancestors } = require("../jsonlogic/dependency_graph.js");
const { resolve_preset_value, apply_presets } = require("../jsonlogic/preset_fields.js");
const { location_tree, PROVINCE_TRANSLATIONS } = require("../controllers/locations/get_locations.js");
const { build_test_data_plan } = require("./test_data_plan.js");
const { sample_geolocation } = require("./test_geo_sampler.js");

/**
 * One random submission for a form, built from a generation PLAN
 * (utilities/test_data_plan.js) that is worked out once per job: the
 * flattened schema, the number range of every number field, and a
 * coverage scheduler for every cascade. A record therefore
 * - draws each number inside the range the user chose (clamped into the
 *   field's own rules);
 * - takes its whole location chain from the scheduler, so every district,
 *   sector, cell and village is visited as early as the record count allows
 *   and the cascade is coherent by construction;
 * - places its GPS point inside the outline of the deepest place it names,
 *   or inside the City of Kigali when it names none.
 * The caller still runs the result through validate_submission_data
 * exactly like a real submit and discards what does not pass.
 */

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
// validation.
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

function field_is_visible(field, trimmed) {
  if (!field.visibility_condition) return true;
  const result = evaluate_rule(field.visibility_condition, trimmed);
  return result.error ? true : result.value !== false;
}

/**
 * Text shaped by the field's own pattern rule when it is one of the common
 * digit patterns ("^[0-9]{16}$", "^\d{10}$", "^[0-9]{4,8}$") - a National
 * ID or a code can never be met by random words. null for any other rule.
 */
function text_from_pattern(field) {
  const rule = (field.validation_rules || []).find((entry) => entry && entry.operator === "matches_pattern" && typeof entry.value === "string");
  if (!rule) return null;
  const match = rule.value.match(/^\^?(?:\[0-9\]|\\d)\{(\d+)(?:,(\d+))?\}\$?$/);
  if (!match) return null;
  const least = Number(match[1]);
  const most = match[2] ? Number(match[2]) : least;
  const length = random_int(least, most);
  let digits = "";
  for (let index = 0; index < length; index += 1) digits += String(random_int(index === 0 ? 1 : 0, 9));
  return digits;
}

/** A multi select answer that respects exclusive options: one alone, or several of the others. */
function random_multi_select(field, data) {
  const options = available_options(field, data).filter((option) => option && option.value !== undefined && option.value !== null && String(option.value).trim() !== "");
  if (options.length === 0) return undefined;
  const exclusive = options.filter((option) => option.exclusive === true).map((option) => option.value);
  const ordinary = options.filter((option) => option.exclusive !== true).map((option) => option.value);
  if (exclusive.length > 0 && (ordinary.length === 0 || Math.random() < 0.15)) return [pick_random(exclusive)];
  const count = random_int(1, Math.min(3, ordinary.length));
  return ordinary.slice().sort(() => Math.random() - 0.5).slice(0, count);
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
// Kept for callers that walk the tree themselves (test approvals); the
// generator itself takes whole paths from the plan's scheduler.

const LOCATION_LEVELS_ORDER = ["provinces", "districts", "sectors", "cells", "villages"];
const LOCATION_CHILD_KEYS = ["districts", "sectors", "cells", "villages"];

function normalize_name(value) {
  return String(value || "").toLowerCase().trim();
}

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
 * A chain field's value from the path the scheduler dealt this record: the
 * name at the field's own level. undefined when the path stops above it
 * (a district with no sectors listed) - the respondent would see nothing
 * for that field either.
 */
function chain_value(field, plan, record_paths) {
  const chain = plan.chain_of_field.get(field.id);
  if (!chain) return undefined;
  const path = record_paths.get(chain);
  if (!path) return undefined;
  const index = (chain.first_level || 0) + chain.field_ids.indexOf(field.id);
  return path[index];
}

/** A number inside the field's planned range, widening only when its other rules keep refusing. */
function random_number(field, plan, attempt) {
  const range = plan.ranges.get(field.id) || { min: 0, max: 100, decimals: 0 };
  const span = attempt < 12 ? 1 : 1 + attempt - 12;
  const min = range.min;
  const max = range.max + (range.max - range.min) * (span - 1);
  const value = min + Math.random() * (max - min);
  if (range.decimals === 0) return String(Math.round(value));
  return String(Number(value.toFixed(range.decimals)));
}

/** The location trail this record actually holds, for the geo sampler. */
function record_location_trail(plan, data) {
  const chain = plan.location_chain;
  if (!chain) return [];
  const trail = [];
  const start = chain.first_level || 0;
  for (let index = 0; index < start; index += 1) trail.push(undefined);
  chain.field_ids.forEach((id) => trail.push(has_real_answer(data[id]) ? String(data[id]) : undefined));
  // A trail is only as deep as its unbroken prefix of real names.
  const out = [];
  for (const name of trail) {
    if (name === undefined) break;
    out.push(name);
  }
  // Without a province answer (chain starting at district) prepend Kigali so the walk has a root.
  return start > 0 && out.length === 0 ? [] : start > 0 ? ["Umujyi wa Kigali"].concat(out.slice(start)) : out;
}

/**
 * One random candidate value for a field, appropriate to its type. Returns
 * undefined when the field cannot be answered right now (no matching
 * options yet, or a type with nothing to generate).
 */
function generate_candidate(field, data, attempt, plan, record_paths) {
  // A preset field is never random: it always carries its configured
  // default, so every generated record respects it exactly like a real one.
  const preset = resolve_preset_value(field, data);
  if (preset.has) return preset.value;
  if (plan.chain_of_field.has(field.id)) {
    const scheduled = chain_value(field, plan, record_paths);
    if (scheduled !== undefined) return scheduled;
    if (field.data_source && field.data_source.type === "api") return undefined;
  }
  switch (field.type) {
    case "text": {
      const patterned = text_from_pattern(field);
      if (patterned !== null) return patterned;
      if (attempt > 12) return `${random_words(2)} ${random_int(1, 99)}`;
      if (attempt > 6) return random_words(random_int(3, 6));
      return random_words(random_int(1, 3));
    }
    case "large_text":
      return random_words(random_int(6, 18));
    case "number":
      return random_number(field, plan, attempt);
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
    case "multi_select":
      return random_multi_select(field, data);
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
      // Inside the deepest place this record names, else inside Kigali.
      return sample_geolocation(record_location_trail(plan, data));
    case "signature":
      return generate_media_candidate(field);
    case "hidden":
      return field.default_value !== undefined && field.default_value !== null ? field.default_value : undefined;
    default:
      if (MEDIA_TYPES.has(field.type)) return generate_media_candidate(field);
      return undefined;
  }
}

/**
 * True when every error-severity validation rule of this one field passes
 * against the data as it currently stands (warnings never block).
 */
function passes_own_rules(field, data, trimmed) {
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
 * Generates one full random submission for a plan (or a bare schema, for
 * which a plan is built on the spot): fields are answered in document
 * order across a few passes (so a parent's value exists before its
 * dependents pick from it), visibility conditions and parent-group locks
 * decide what gets answered at all, computed fields are refreshed between
 * passes, and each field's own validation rules are retried against fresh
 * candidates.
 */
function generate_test_record(schema_or_plan) {
  const plan = schema_or_plan && schema_or_plan.flat_fields ? schema_or_plan : build_test_data_plan(schema_or_plan, {});
  const data = {};
  // One scheduled path per cascade, dealt before anything is answered.
  const record_paths = new Map();
  plan.chains.forEach((chain) => {
    const path = chain.scheduler.next();
    if (path) record_paths.set(chain, path);
  });

  // The trimmed snapshot the rules read, kept in step with data rather
  // than rebuilt from every answer for every field.
  let trimmed = {};
  for (let pass = 0; pass < 3; pass += 1) {
    plan.computed_fields.forEach((field) => {
      const computed_result = evaluate_rule(field.computed.formula, trimmed);
      data[field.id] = computed_result.value;
      trimmed[field.id] = trim_value(computed_result.value);
    });

    // Presets first, so children generated in this pass pick under them.
    apply_presets(plan.schema.fields || [], data);
    trimmed = build_trimmed_evaluation_data(data);

    const own_visible = new Map(plan.flat_fields.map((field) => [field.id, field_is_visible(field, trimmed)]));

    plan.answer_fields.forEach((field) => {
      if (field.computed && field.computed.enabled && field.computed.formula) return;
      if (has_real_answer(data[field.id])) return;
      if (!own_visible.get(field.id) || !is_visible_through_ancestors(field.id, plan.parent_map, own_visible)) return;
      if (is_locked_by_parent_groups(field, data)) return;

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const candidate = generate_candidate(field, data, attempt, plan, record_paths);
        if (candidate === undefined) break;
        data[field.id] = candidate;
        trimmed[field.id] = trim_value(candidate);
        if (passes_own_rules(field, data, trimmed)) break;
        if (attempt === 19 && !field.mandatory) {
          delete data[field.id];
          delete trimmed[field.id];
        }
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
