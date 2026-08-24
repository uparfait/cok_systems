/**
 * Reads a field-authored translated object (label, placeholder, help text,
 * messages) in the active language, falling back across the other
 * supported languages before returning an empty string.
 */
export function get_field_text(translated_object, language) {
  if (!translated_object) return "";
  return translated_object[language] || translated_object.en || translated_object.kn || translated_object.fr || "";
}

/**
 * Whether a field has any label text authored in at least one language,
 * used to keep unlabeled fields out of "depends on field" pickers where a
 * blank entry would be meaningless to select.
 */
export function has_field_label(field) {
  return get_field_text(field.label, "en").trim().length > 0;
}

/**
 * cascading_select links to a "parent" field via field.parent_field_id -
 * when set, each option only ever shows once tagged (via its own
 * parent_value) to match the parent's current answer, and the field stays
 * disabled until the parent actually has one. A field with no
 * parent_field_id set behaves exactly as before: every option always
 * shows, never disabled by this. Never filters in the builder, where
 * there is no live parent answer to filter against.
 */
export function get_parent_linked_options_state(field, all_values, is_builder) {
  const options = field.options || [];
  if (!field.parent_field_id || is_builder) {
    return { visible_options: options, parent_unanswered: false };
  }
  const parent_value = all_values ? all_values[field.parent_field_id] : undefined;
  return {
    visible_options: options.filter((option) => option.parent_value === parent_value),
    parent_unanswered: parent_value === undefined || parent_value === null || parent_value === "",
  };
}

/**
 * The comparison operators a parent option group's own condition can use -
 * shared between the authoring UI (FieldSettingsDrawer) and the runtime
 * evaluation below so the two can never silently drift apart.
 */
export const DCS_PARENT_GROUP_OPERATORS = ["equals", "not_equals", "includes", "not_includes", "less_than", "greater_than"];

/**
 * True when a parent field's current answer (actual_value) satisfies one
 * condition group's own operator/value. "equals"/"includes" both treat an
 * array-valued parent answer (a multi_select parent) as "does it contain
 * this value", since a plain === would otherwise never match one.
 */
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

/**
 * single_select/multi_select/select_group may instead split their options
 * into any number of parent-driven condition groups
 * (field.parent_option_groups), each with its own parent field, comparison
 * operator, trigger value and option list - unlike cascading_select's
 * single always-linked parent, this is opt-in per field
 * (field.parent_dependency_enabled) and each group can reference a
 * different parent entirely. The visible options are the union of every
 * group whose condition currently matches; with none matching (or no
 * groups configured while enabled) there is nothing to select, so the
 * field is disabled. A field with parent_dependency_enabled false simply
 * uses its own flat field.options, exactly like an ordinary select always
 * has. In the builder every group's options are shown concatenated
 * (deduped by id) since there is no live parent answer to filter against
 * and the author needs to see everything they have configured.
 */
export function get_field_options_state(field, all_values, is_builder) {
  if (!field.parent_dependency_enabled) {
    return { visible_options: field.options || [], is_locked: false };
  }

  const groups = field.parent_option_groups || [];

  if (is_builder) {
    const seen_ids = new Set();
    const visible_options = [];
    groups.forEach((group) => {
      (group.options || []).forEach((option) => {
        if (seen_ids.has(option.id)) return;
        seen_ids.add(option.id);
        visible_options.push(option);
      });
    });
    return { visible_options, is_locked: false };
  }

  const visible_options = [];
  groups.forEach((group) => {
    if (!group.parent_field_id) return;
    const actual_value = all_values ? all_values[group.parent_field_id] : undefined;
    if (!has_real_answer(actual_value)) return;
    if (evaluate_parent_group_condition(group.operator || "equals", actual_value, group.value)) {
      visible_options.push(...(group.options || []));
    }
  });

  return { visible_options, is_locked: visible_options.length === 0 };
}
