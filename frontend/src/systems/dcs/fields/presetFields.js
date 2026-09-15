import { trimmed_lookup, has_real_answer, evaluate_parent_group_condition } from "./fieldText.js";

/**
 * Preset (default-valued) fields. A data-collection field may carry
 *
 *   default_config: {
 *     enabled: true,
 *     mode: "constant" | "by_parent",
 *     value: <answer>,                 // constant: always this
 *     parent_field_id: "<field id>",   // by_parent: which field decides
 *     by_parent: { "<parent answer>": <answer> },
 *   }
 *
 * Whenever the config resolves to a value, the field is a PRESET field: it
 * is never shown to the respondent, its answer is forced to that value,
 * it is never mandatory, and everything that depends on it (cascading
 * children, approval routing, test data, dashboards) simply sees the
 * answer. Mirrors dc_backend/jsonlogic/preset_fields.js - keep in sync.
 */

const NEVER_PRESET_TYPES = ["paragraph", "header", "file", "image_block", "horizontal_line", "section", "group", "hidden"];

export function preset_config(field) {
  const config = field && field.default_config;
  if (!config || typeof config !== "object" || !config.enabled) return null;
  if (NEVER_PRESET_TYPES.includes(field.type)) return null;
  return config;
}

/** The field whose answer picks this field's default in by_parent mode. */
export function preset_parent_id(field) {
  const config = preset_config(field) || field.default_config || {};
  if (config.parent_field_id) return config.parent_field_id;
  if (field.parent_field_id) return field.parent_field_id;
  const group = (field.parent_option_groups || []).find((entry) => entry && entry.parent_field_id);
  return group ? group.parent_field_id : null;
}

/** { has, value }: whether the field's default resolves right now, and to what. */
export function resolve_preset_value(field, values) {
  const config = preset_config(field);
  if (!config) return { has: false, value: undefined };
  if (config.mode === "by_parent") {
    const parent_id = preset_parent_id(field);
    const parent_value = parent_id ? trimmed_lookup(values, parent_id) : undefined;
    if (!has_real_answer(parent_value)) return { has: false, value: undefined };
    const mapped = (config.by_parent || {})[String(parent_value)];
    return has_real_answer(mapped) ? { has: true, value: mapped } : { has: false, value: undefined };
  }
  return has_real_answer(config.value) ? { has: true, value: config.value } : { has: false, value: undefined };
}

export const is_preset_field = (field, values) => resolve_preset_value(field, values).has;

/** True when the field carries an enabled default at all (whatever it resolves to). */
export const has_preset_config = (field) => preset_config(field) !== null;

function walk_fields(fields, visit) {
  (fields || []).forEach((field) => {
    if (!field) return;
    visit(field);
    if (Array.isArray(field.children)) walk_fields(field.children, visit);
  });
}

/**
 * The answers with every preset field forced to its default. Parents may
 * come after their children in document order, so the pass repeats until
 * nothing changes (bounded).
 */
export function apply_preset_values(schema, values) {
  const next = Object.assign({}, values || {});
  const fields = (schema && schema.fields) || [];
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    walk_fields(fields, (field) => {
      const resolved = resolve_preset_value(field, next);
      if (resolved.has && next[field.id] !== resolved.value) {
        next[field.id] = resolved.value;
        changed = true;
      }
    });
    if (!changed) break;
  }
  return next;
}

/**
 * The option values a field can still take once the presets of the form
 * are applied: a cascading child whose parent is preset keeps only the
 * options under that parent value, a parent-dependent select group keeps
 * only the groups the preset parent answer satisfies, and a preset field
 * itself collapses to its own default. Everything else keeps every option.
 */
export function options_under_presets(field, schema) {
  const preset_values = apply_preset_values(schema, {});
  const own = resolve_preset_value(field, preset_values);
  if (own.has) {
    const all = flatten_options(field);
    const match = all.find((option) => String(option.value) === String(own.value));
    return match ? [match] : [{ id: `preset_${field.id}`, value: own.value, label: { en: String(own.value) } }];
  }
  if (field.type === "cascading_select" && field.parent_field_id) {
    const parent_value = preset_values[field.parent_field_id];
    if (has_real_answer(parent_value)) return (field.options || []).filter((option) => String(option.parent_value) === String(parent_value));
    return field.options || [];
  }
  if (field.parent_dependency_enabled && Array.isArray(field.parent_option_groups)) {
    // A group whose parent is preset stays only if that preset answer
    // satisfies the group's own condition; groups on unpreset parents stay.
    return field.parent_option_groups
      .filter((group) => {
        if (!group || !group.parent_field_id) return true;
        const parent_value = preset_values[group.parent_field_id];
        if (!has_real_answer(parent_value)) return true;
        return evaluate_parent_group_condition(group.operator || "equals", parent_value, group.value);
      })
      .flatMap((group) => (group && group.options) || []);
  }
  return flatten_options(field);
}

/** The options a child field offers under ONE given parent answer (for the by_parent editor). */
export function child_options_for_parent(field, parent_value) {
  if (field.type === "cascading_select" && field.parent_field_id) {
    return (field.options || []).filter((option) => String(option.parent_value) === String(parent_value));
  }
  if (field.parent_dependency_enabled && Array.isArray(field.parent_option_groups)) {
    return field.parent_option_groups
      .filter((group) => group && group.parent_field_id && evaluate_parent_group_condition(group.operator || "equals", parent_value, group.value))
      .flatMap((group) => group.options || []);
  }
  return flatten_options(field);
}

export { flatten_options as flatten_field_options };

function flatten_options(field) {
  if (Array.isArray(field.options) && field.options.length > 0) return field.options;
  if (Array.isArray(field.parent_option_groups)) return field.parent_option_groups.flatMap((group) => (group && group.options) || []);
  return [];
}
