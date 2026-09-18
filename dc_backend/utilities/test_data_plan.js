const { flatten_fields, build_field_parent_map } = require("../jsonlogic/dependency_graph.js");
const { location_tree, PROVINCE_TRANSLATIONS } = require("../controllers/locations/get_locations.js");

/**
 * Everything one generation job works out ONCE about its form, so the
 * generator never redoes it per record: the flattened schema, the number
 * range of every number field (the user's choice intersected with the
 * field's own min / max rules), and a coverage scheduler for every cascade
 * so the places and options a form asks for are all visited as early as
 * the record count allows.
 *
 * COVERAGE. Picking a cascade value at random per level leaves a village
 * with many siblings unseen for hundreds of records. The scheduler instead
 * lays out every leaf path of the cascade in ROUNDS: round one holds one
 * path per top-level value (every district in three records), round two
 * one path per value of the next level not yet seen (every sector within
 * thirty-five), then every cell, then every village - each round shuffled.
 * A record takes the next scheduled path with probability `cover_share`
 * (0.8) and a uniformly random leaf otherwise, so the data is exhaustive
 * without being mechanical. Records that only ask for the upper levels
 * take the matching prefix of the path.
 */

const LOCATION_LEVELS = ["provinces", "districts", "sectors", "cells", "villages"];
const CHILD_KEYS = ["districts", "sectors", "cells", "villages"];
const DEFAULT_COVER_SHARE = 0.8;
const DEFAULT_RANGE = { min: 0, max: 100 };
const NON_ANSWER_TYPES = new Set(["paragraph", "header", "file", "image_block", "horizontal_line", "section", "group"]);

function normalize_name(value) {
  return String(value || "").toLowerCase().trim();
}

function shuffle(list) {
  const out = list.slice();
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const held = out[index];
    out[index] = out[swap];
    out[swap] = held;
  }
  return out;
}

// ---------------------------------------------------------------- numbers
function rule_bounds(field) {
  const bounds = { min: null, max: null };
  (field.validation_rules || []).forEach((rule) => {
    if (!rule || rule.severity === "warning") return;
    const value = Number(rule.value);
    if (!Number.isFinite(value)) return;
    if (rule.operator === "min_value") bounds.min = bounds.min === null ? value : Math.max(bounds.min, value);
    if (rule.operator === "max_value") bounds.max = bounds.max === null ? value : Math.min(bounds.max, value);
  });
  return bounds;
}

/**
 * The range a number field is generated in: the user's min / max when
 * given, clamped into the field's own rule bounds so no record fails
 * validation over a range the form forbids; the rule bounds alone when the
 * user set nothing; 0..100 when there is neither.
 */
function resolve_range(field, requested) {
  const rules = rule_bounds(field);
  let min = requested && Number.isFinite(Number(requested.min)) ? Number(requested.min) : rules.min !== null ? rules.min : rules.max !== null ? Math.min(0, rules.max) : DEFAULT_RANGE.min;
  let max = requested && Number.isFinite(Number(requested.max)) ? Number(requested.max) : rules.max !== null ? rules.max : Math.max(min + 1, rules.min !== null ? rules.min + 100 : DEFAULT_RANGE.max);
  if (rules.min !== null) min = Math.max(min, rules.min);
  if (rules.max !== null) max = Math.min(max, rules.max);
  if (max < min) max = min;
  const decimals = Number.isInteger(min) && Number.isInteger(max) ? 0 : 2;
  return { min, max, decimals, rule_min: rules.min, rule_max: rules.max };
}

/** The number fields of a schema with their bounds - what the UI shows before generating. */
function describe_number_fields(schema) {
  return flatten_fields((schema && schema.fields) || [])
    .filter((field) => field && field.id && field.type === "number" && !(field.computed && field.computed.enabled))
    .map((field) => {
      const range = resolve_range(field, null);
      return { id: field.id, label: field.label || {}, min: range.min, max: range.max, rule_min: range.rule_min, rule_max: range.rule_max };
    });
}

// -------------------------------------------------------------- locations
function find_match(items, value) {
  const search = normalize_name(value);
  return (items || []).find((item) => {
    const name = typeof item === "string" ? item : item.name;
    if (normalize_name(name) === search) return true;
    const translations = (typeof item === "object" && item && item.translations) || PROVINCE_TRANSLATIONS[name];
    return translations ? Object.values(translations).some((entry) => normalize_name(entry) === search) : false;
  });
}

/** The children under a trail of names, from the country's location tree. */
function locations_under(path) {
  const country = location_tree && location_tree.Rwanda;
  if (!country) return [];
  let items = country.provinces || [];
  for (let index = 0; index < path.length; index += 1) {
    const match = find_match(items, path[index]);
    if (!match || typeof match === "string") return [];
    items = match[CHILD_KEYS[index]] || [];
  }
  return items;
}

const name_of = (item) => (typeof item === "string" ? item : item.name);

/** Every leaf path (down to `depth` levels) under the given root trail. */
function leaf_paths(root, depth) {
  const out = [];
  const walk = (trail, items, level) => {
    items.forEach((item) => {
      const next = trail.concat([name_of(item)]);
      const children = level + 1 < depth && typeof item === "object" ? item[CHILD_KEYS[level]] || [] : [];
      if (level + 1 >= depth || children.length === 0) out.push(next);
      else walk(next, children, level + 1);
    });
  };
  walk(root.slice(), locations_under(root), root.length);
  return out;
}

/**
 * Coverage rounds over a set of paths: round k holds, for every distinct
 * prefix of length root+k+1 not yet seen, one path - so every value of each
 * level appears as early as possible, shallow levels first.
 */
function coverage_order(paths, root_length) {
  const scheduled = [];
  const used = new Set();
  const max_depth = paths.reduce((deep, path) => Math.max(deep, path.length), 0);
  const indexes = paths.map((path, index) => index);
  for (let depth = root_length + 1; depth <= max_depth; depth += 1) {
    const seen = new Set();
    const round = [];
    shuffle(indexes).forEach((index) => {
      const path = paths[index];
      if (used.has(index) || path.length < depth) return;
      const prefix = path.slice(0, depth).join("/");
      if (seen.has(prefix)) return;
      seen.add(prefix);
      used.add(index);
      round.push(path);
    });
    scheduled.push(...shuffle(round));
  }
  return scheduled;
}

/** A scheduler handing out paths: the coverage order, then over again, mixed with random leaves. */
function make_scheduler(paths, root_length, cover_share) {
  const order = coverage_order(paths, root_length);
  let cursor = 0;
  return {
    size: paths.length,
    levels: paths.reduce((deep, path) => Math.max(deep, path.length), 0),
    next() {
      if (paths.length === 0) return null;
      if (order.length > 0 && Math.random() < cover_share) {
        const path = order[cursor % order.length];
        cursor += 1;
        return path;
      }
      return paths[Math.floor(Math.random() * paths.length)];
    },
  };
}

/**
 * The api-sourced location chains of a form: for each chain root, the
 * ordered fields (province -> ... -> village) and a scheduler over every
 * leaf path the chain can reach. A preset root (a province fixed to Kigali)
 * pins the trail above the first free level.
 */
function build_location_chains(flat_fields, fields_by_id, cover_share) {
  const chains = [];
  const roots = flat_fields.filter((field) => field && field.type === "cascading_select" && field.data_source && field.data_source.type === "api" && !field.parent_field_id);
  roots.forEach((root) => {
    const ordered = [root];
    let current = root;
    for (let guard = 0; guard < 6; guard += 1) {
      const child = flat_fields.find((field) => field && field.parent_field_id === current.id && field.type === "cascading_select");
      if (!child) break;
      ordered.push(child);
      current = child;
    }
    const first_level = LOCATION_LEVELS.indexOf((root.data_source && root.data_source.level) || "provinces");
    const depth = first_level + ordered.length;
    const preset = root.default_config && root.default_config.enabled && root.default_config.mode === "constant" && root.default_config.value ? [String(root.default_config.value)] : [];
    const paths = leaf_paths(preset, depth);
    chains.push({ field_ids: ordered.map((field) => field.id), first_level, scheduler: make_scheduler(paths, preset.length, cover_share) });
  });
  return chains;
}

/**
 * Option-based cascades (a cascading_select whose options carry
 * parent_value): the same coverage over their option paths.
 */
function build_option_chains(flat_fields, cover_share) {
  const chains = [];
  const roots = flat_fields.filter((field) => field && field.type === "cascading_select" && !(field.data_source && field.data_source.type === "api") && !field.parent_field_id && Array.isArray(field.options) && field.options.length > 0);
  const child_of = (id) => flat_fields.find((field) => field && field.parent_field_id === id && field.type === "cascading_select" && Array.isArray(field.options));
  roots.forEach((root) => {
    const ordered = [root];
    let current = child_of(root.id);
    while (current && ordered.length < 6) {
      ordered.push(current);
      current = child_of(current.id);
    }
    let paths = root.options.map((option) => [option.value]);
    ordered.slice(1).forEach((field) => {
      const next = [];
      paths.forEach((path) => {
        const children = field.options.filter((option) => String(option.parent_value) === String(path[path.length - 1]));
        if (children.length === 0) next.push(path);
        else children.forEach((option) => next.push(path.concat([option.value])));
      });
      paths = next;
    });
    chains.push({ field_ids: ordered.map((field) => field.id), first_level: 0, scheduler: make_scheduler(paths, 0, cover_share) });
  });
  return chains;
}

/**
 * Builds the plan. options: { number_ranges: { field_id: { min, max } },
 * cover_cascades: boolean, cover_share: 0..1 }.
 */
function build_test_data_plan(schema, options) {
  const settings = options || {};
  const flat_fields = flatten_fields((schema && schema.fields) || []).filter((field) => field && field.id && field.type);
  const fields_by_id = new Map(flat_fields.map((field) => [field.id, field]));
  const cover_share = settings.cover_cascades === false ? 0 : Number.isFinite(Number(settings.cover_share)) ? Math.min(1, Math.max(0, Number(settings.cover_share))) : DEFAULT_COVER_SHARE;
  const ranges = new Map();
  flat_fields.forEach((field) => {
    if (field.type === "number") ranges.set(field.id, resolve_range(field, (settings.number_ranges || {})[field.id]));
  });
  const chains = build_location_chains(flat_fields, fields_by_id, cover_share).concat(build_option_chains(flat_fields, cover_share));
  const chain_of_field = new Map();
  chains.forEach((chain) => chain.field_ids.forEach((id) => chain_of_field.set(id, chain)));
  const geo_fields = flat_fields.filter((field) => field.type === "geolocation").map((field) => field.id);
  return {
    schema,
    flat_fields,
    fields_by_id,
    parent_map: build_field_parent_map(schema.fields || []),
    answer_fields: flat_fields.filter((field) => !NON_ANSWER_TYPES.has(field.type)),
    computed_fields: flat_fields.filter((field) => field.computed && field.computed.enabled && field.computed.formula),
    ranges,
    chains,
    chain_of_field,
    geo_fields,
    location_chain: chains.find((chain) => chain.first_level !== undefined && fields_by_id.get(chain.field_ids[0]).data_source) || null,
  };
}

/** What the UI shows before generating: number fields, cascades and the GPS note. */
function describe_plan(schema) {
  const plan = build_test_data_plan(schema, {});
  return {
    number_fields: describe_number_fields(schema),
    has_geolocation: plan.geo_fields.length > 0,
    cascades: plan.chains.map((chain) => ({ field_ids: chain.field_ids, paths: chain.scheduler.size, levels: chain.scheduler.levels - (chain.first_level || 0) })),
  };
}

module.exports = {
  build_test_data_plan,
  describe_plan,
  describe_number_fields,
  resolve_range,
  coverage_order,
  leaf_paths,
  LOCATION_LEVELS,
};
