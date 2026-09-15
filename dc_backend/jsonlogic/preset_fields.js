/**
 * Preset (default-valued) fields - the server mirror of
 * frontend/src/systems/dcs/fields/presetFields.js; keep both in sync.
 *
 *   default_config: {
 *     enabled: true,
 *     mode: "constant" | "by_parent",
 *     value: <answer>,                 // constant: always this
 *     parent_field_id: "<field id>",   // by_parent: which field decides
 *     by_parent: { "<parent answer>": <answer> },
 *   }
 *
 * When the config resolves, the field's answer is FORCED to the default:
 * it is never asked, never mandatory, never subject to its own rules, and
 * the value simply flows into everything downstream.
 */

const NEVER_PRESET_TYPES = ["paragraph", "header", "file", "image_block", "horizontal_line", "section", "group", "hidden"];

function has_real_answer(value) {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function trimmed(value) {
  return typeof value === "string" ? value.trim() : value;
}

function preset_config(field) {
  const config = field && field.default_config;
  if (!config || typeof config !== "object" || !config.enabled) return null;
  if (NEVER_PRESET_TYPES.includes(field.type)) return null;
  return config;
}

function preset_parent_id(field) {
  const config = field.default_config || {};
  if (config.parent_field_id) return config.parent_field_id;
  if (field.parent_field_id) return field.parent_field_id;
  const group = (field.parent_option_groups || []).find((entry) => entry && entry.parent_field_id);
  return group ? group.parent_field_id : null;
}

/** { has, value }: whether the field's default resolves against these answers, and to what. */
function resolve_preset_value(field, values) {
  const config = preset_config(field);
  if (!config) return { has: false, value: undefined };
  if (config.mode === "by_parent") {
    const parent_id = preset_parent_id(field);
    const parent_value = parent_id ? trimmed((values || {})[parent_id]) : undefined;
    if (!has_real_answer(parent_value)) return { has: false, value: undefined };
    const mapped = (config.by_parent || {})[String(parent_value)];
    return has_real_answer(mapped) ? { has: true, value: mapped } : { has: false, value: undefined };
  }
  return has_real_answer(config.value) ? { has: true, value: config.value } : { has: false, value: undefined };
}

const is_preset_field = (field, values) => resolve_preset_value(field, values).has;
const has_preset_config = (field) => preset_config(field) !== null;

function walk_fields(fields, visit) {
  (fields || []).forEach((field) => {
    if (!field) return;
    visit(field);
    if (Array.isArray(field.children)) walk_fields(field.children, visit);
  });
}

/** Forces every resolvable preset onto the given answers (in place) and returns the ids it set. */
function apply_presets(fields, values) {
  const preset_ids = new Set();
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    walk_fields(fields, (field) => {
      const resolved = resolve_preset_value(field, values);
      if (!resolved.has) return;
      preset_ids.add(field.id);
      if (values[field.id] !== resolved.value) {
        values[field.id] = resolved.value;
        changed = true;
      }
    });
    if (!changed) break;
  }
  return preset_ids;
}

/** The values a form ALWAYS carries before anyone answers - its constant presets and what they cascade into. */
function preset_baseline(fields) {
  const values = {};
  apply_presets(fields, values);
  return values;
}

module.exports = {
  preset_config,
  preset_parent_id,
  resolve_preset_value,
  is_preset_field,
  has_preset_config,
  apply_presets,
  preset_baseline,
};
