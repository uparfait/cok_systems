const LAZY_TYPES = ["select_group", "cascading_select"];
const LAZY_OPTIONS_THRESHOLD = 10;

/**
 * How many real, selectable options one select_group/cascading_select field
 * actually carries - for select_group split into parent_option_groups, this
 * is the total across every group combined (the true payload weight), not
 * just how many groups there are.
 */
function count_field_options(field) {
  if (!field) return 0;
  if (field.type === "cascading_select") return (field.options || []).length;
  if (field.type === "select_group") {
    if (field.parent_dependency_enabled) {
      return (field.parent_option_groups || []).reduce((sum, group) => sum + (group.options || []).length, 0);
    }
    return (field.options || []).length;
  }
  return 0;
}

/**
 * True for a select_group/cascading_select field carrying more than
 * LAZY_OPTIONS_THRESHOLD real options - the only fields ever stripped for a
 * client response and fetched back on demand. Everything else (including a
 * small select_group/cascading_select) is always sent whole, exactly as
 * before - lazy-loading a handful of options would only add complexity with
 * no real payload saved.
 */
function is_lazy_options_field(field) {
  return !!field && LAZY_TYPES.includes(field.type) && count_field_options(field) > LAZY_OPTIONS_THRESHOLD;
}

/**
 * Mirrors evaluate_parent_group_condition in
 * frontend/src/systems/dcs/fields/fieldText.js - keep both in sync. Decides
 * whether one parent_option_group's own operator/value is satisfied by the
 * parent field's current answer.
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

/**
 * Recursively finds a field by id, searching into group/section children -
 * mirrors find_field_by_id in frontend/src/systems/dcs/builder/builderUtils.js.
 */
function find_field_by_id(fields, field_id) {
  for (const field of fields || []) {
    if (!field) continue;
    if (field.id === field_id) return field;
    if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
      const found = find_field_by_id(field.children, field_id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Strips a lazy-eligible field's heavy option content down to nothing but a
 * lazy_options marker and a count to display - the real content is fetched
 * separately (see resolve_field_options) only once the field actually needs
 * it (it becomes visible to a respondent, or an author opens its settings).
 * Every other field is returned completely untouched.
 *
 * A parent-dependent select_group keeps every one of its
 * parent_option_groups (just each group's own options emptied out) rather
 * than losing the array entirely - that per-group parent_field_id/operator/
 * value is small, bounded structural metadata (one entry per real group,
 * never per option), and it is the only way the respondent's browser can
 * tell which single field to watch and which exact value to ask the
 * lazy-options endpoint for once a matching group's real options are
 * actually needed. cascading_select needs no such shell: its parent field
 * is already a plain field.parent_field_id, so its whole (flat, per-option)
 * options array can be emptied outright with nothing lost.
 */
function strip_lazy_options_from_field(field) {
  if (!field) return field;
  if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
    return Object.assign({}, field, { children: strip_lazy_options_from_fields(field.children) });
  }
  if (!is_lazy_options_field(field)) return field;

  const stripped = Object.assign({}, field, {
    lazy_options: true,
    options_count: count_field_options(field),
  });
  if (field.type === "cascading_select" || !field.parent_dependency_enabled) {
    stripped.options = [];
  } else {
    stripped.parent_option_groups = (field.parent_option_groups || []).map((group) =>
      Object.assign({}, group, { options: [] }),
    );
  }
  return stripped;
}

/**
 * Recursively strips every lazy-eligible field in a whole fields array -
 * never mutates the input, always returns a fresh array/objects so the
 * caller can serialize the result straight into a response.
 */
function strip_lazy_options_from_fields(fields) {
  return (fields || []).map((field) => strip_lazy_options_from_field(field));
}

/**
 * Resolves the real option content for one field, given whether the caller
 * supplied a parent answer to filter by:
 * - No parent value at all: the field's own COMPLETE, real data - used both
 *   by the builder (opening a lazy field's settings needs everything to
 *   edit) and by a lazy field with no parent dependency at runtime (nothing
 *   to filter by, the whole list is the answer either way).
 * - A parent value given, on a parent-dependent select_group: only the
 *   options belonging to whichever parent_option_group(s) currently match
 *   that answer (mirrors get_field_options_state in
 *   frontend/src/systems/dcs/fields/fieldText.js) - e.g. only the cells that
 *   belong to the one sector actually selected, never the whole country.
 * - A parent value given, on a cascading_select: only the options tagged
 *   with that exact parent_value.
 * Returns null when the field doesn't exist or isn't one of these types.
 */
function resolve_field_options(fields, field_id, has_parent_value, parent_value) {
  const field = find_field_by_id(fields, field_id);
  if (!field) return null;

  if (field.type === "cascading_select") {
    if (!has_parent_value || !field.parent_field_id) {
      return { options: field.options || [] };
    }
    const trimmed_parent_value = typeof parent_value === "string" ? parent_value.trim() : parent_value;
    return { options: (field.options || []).filter((option) => option.parent_value === trimmed_parent_value) };
  }

  if (field.type === "select_group") {
    if (!field.parent_dependency_enabled) {
      return { options: field.options || [] };
    }
    if (!has_parent_value) {
      return { parent_option_groups: field.parent_option_groups || [] };
    }
    const visible_options = [];
    (field.parent_option_groups || []).forEach((group) => {
      if (evaluate_parent_group_condition(group.operator || "equals", parent_value, group.value)) {
        visible_options.push(...(group.options || []));
      }
    });
    return { options: visible_options };
  }

  return null;
}

/**
 * Reconciles an incoming (possibly still-lazy) fields array against the
 * document already stored for this exact form/template before saving - an
 * editing session that never opened a huge field's settings still carries
 * that field around as an empty lazy_options placeholder, and without this
 * step saving would overwrite its real content with nothing. Any field the
 * author actually touched this session (no lazy_options marker, or real
 * content already loaded into it) is kept exactly as sent; only an
 * untouched, still-empty lazy placeholder is swapped back for its real,
 * previously-stored content. Recurses into group/section children so a
 * lazy field nested inside either is reconciled the same way.
 */
function merge_lazy_fields(incoming_fields, existing_fields) {
  const existing_by_id = new Map();
  (function index(fields) {
    (fields || []).forEach((field) => {
      if (!field || !field.id) return;
      existing_by_id.set(field.id, field);
      if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
        index(field.children);
      }
    });
  })(existing_fields);

  return (incoming_fields || []).map((field) => {
    if (!field) return field;

    if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
      return Object.assign({}, field, { children: merge_lazy_fields(field.children, existing_fields) });
    }

    if (!field.lazy_options) return field;

    const still_empty =
      field.type === "cascading_select" || !field.parent_dependency_enabled
        ? (field.options || []).length === 0
        : (field.parent_option_groups || []).every((group) => (group.options || []).length === 0);
    if (!still_empty) {
      // The author opened this field and it now carries real (possibly
      // edited) content - drop the leftover marker, never store it.
      const { lazy_options, options_count, ...rest } = field;
      return rest;
    }

    const existing_field = existing_by_id.get(field.id);
    if (!existing_field) return field;
    const { lazy_options, options_count, ...rest } = field;
    return Object.assign({}, rest, {
      options: existing_field.options,
      parent_option_groups: existing_field.parent_option_groups,
    });
  });
}

module.exports = {
  LAZY_OPTIONS_THRESHOLD,
  count_field_options,
  is_lazy_options_field,
  find_field_by_id,
  strip_lazy_options_from_fields,
  resolve_field_options,
  merge_lazy_fields,
};
