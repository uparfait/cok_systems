/**
 * Every reason code validate_form_schema (dc_backend/jsonlogic/validate_schema.js)
 * can produce, mapped to the i18n key that explains it in plain language to
 * a form author. Kept in sync with that file's error reasons by hand - a new
 * backend reason with no entry here just falls back to showing the raw code.
 */
const REASON_I18N_KEYS = {
  fields_must_be_array: "DCS_SCHEMA_ERROR_FIELDS_MUST_BE_ARRAY",
  field_not_object: "DCS_SCHEMA_ERROR_FIELD_NOT_OBJECT",
  field_id_required: "DCS_SCHEMA_ERROR_FIELD_ID_REQUIRED",
  duplicate_field_id: "DCS_SCHEMA_ERROR_DUPLICATE_FIELD_ID",
  field_type_invalid: "DCS_SCHEMA_ERROR_FIELD_TYPE_INVALID",
  field_label_required: "DCS_SCHEMA_ERROR_FIELD_LABEL_REQUIRED",
  nesting_too_deep: "DCS_SCHEMA_ERROR_NESTING_TOO_DEEP",
  visibility_condition_not_logic: "DCS_SCHEMA_ERROR_VISIBILITY_INVALID",
  visibility_condition_too_large: "DCS_SCHEMA_ERROR_VISIBILITY_TOO_LARGE",
  visibility_condition_too_deep: "DCS_SCHEMA_ERROR_VISIBILITY_TOO_DEEP",
  visibility_condition_not_serializable: "DCS_SCHEMA_ERROR_VISIBILITY_INVALID",
  computed_formula_not_logic: "DCS_SCHEMA_ERROR_COMPUTED_INVALID",
  computed_formula_too_large: "DCS_SCHEMA_ERROR_COMPUTED_TOO_LARGE",
  computed_formula_too_deep: "DCS_SCHEMA_ERROR_COMPUTED_TOO_DEEP",
  computed_formula_not_serializable: "DCS_SCHEMA_ERROR_COMPUTED_INVALID",
  validation_rule_not_object: "DCS_SCHEMA_ERROR_RULE_NOT_OBJECT",
  validation_operator_invalid: "DCS_SCHEMA_ERROR_OPERATOR_INVALID",
  validation_operator_not_applicable_to_field_type: "DCS_SCHEMA_ERROR_OPERATOR_NOT_APPLICABLE",
  condition_not_logic: "DCS_SCHEMA_ERROR_CONDITION_INVALID",
  condition_too_large: "DCS_SCHEMA_ERROR_CONDITION_TOO_LARGE",
  condition_too_deep: "DCS_SCHEMA_ERROR_CONDITION_TOO_DEEP",
  condition_not_serializable: "DCS_SCHEMA_ERROR_CONDITION_INVALID",
  validation_message_required: "DCS_SCHEMA_ERROR_RULE_MESSAGE_REQUIRED",
  options_required: "DCS_SCHEMA_ERROR_OPTIONS_REQUIRED",
  option_not_object: "DCS_SCHEMA_ERROR_OPTION_NOT_OBJECT",
  option_id_required: "DCS_SCHEMA_ERROR_OPTION_ID_REQUIRED",
  option_value_required: "DCS_SCHEMA_ERROR_OPTION_VALUE_REQUIRED",
  duplicate_option_value: "DCS_SCHEMA_ERROR_DUPLICATE_OPTION_VALUE",
  cascading_parent_field_id_not_found: "DCS_SCHEMA_ERROR_CASCADING_PARENT_NOT_FOUND",
  cascading_parent_field_id_self_reference: "DCS_SCHEMA_ERROR_CASCADING_PARENT_SELF",
  section_child_type_not_allowed: "DCS_SCHEMA_ERROR_SECTION_CHILD_TYPE",
  section_layout_required: "DCS_SCHEMA_ERROR_SECTION_LAYOUT_REQUIRED",
  section_layout_x_percent_invalid: "DCS_SCHEMA_ERROR_SECTION_LAYOUT_INVALID",
  section_layout_y_percent_invalid: "DCS_SCHEMA_ERROR_SECTION_LAYOUT_INVALID",
  section_layout_width_percent_invalid: "DCS_SCHEMA_ERROR_SECTION_LAYOUT_INVALID",
  section_layout_height_percent_invalid: "DCS_SCHEMA_ERROR_SECTION_LAYOUT_INVALID",
  circular_dependency: "DCS_SCHEMA_ERROR_CIRCULAR_DEPENDENCY",
  file_embedded_not_allowed: "DCS_SCHEMA_ERROR_FILE_EMBEDDED_NOT_ALLOWED",
};

export function humanize_schema_error_reason(reason, translate) {
  const key = REASON_I18N_KEYS[reason];
  if (!key) return reason;
  const translated = translate(key);
  return translated === key ? reason : translated;
}

const VALIDATION_RULE_SUFFIX_RE = /^\.validation_rules\[(\d+)\]/;
const OPTION_SUFFIX_RE = /^\.options\[(\d+)\]/;
const SECTION_LAYOUT_SUFFIX_RE = /^\.section_layout/;

/**
 * Every reason that points to a specific tab in FieldSettingsDrawer, when
 * the error path itself carries no more specific (indexed) location - e.g.
 * a missing label, or a broken conditional-visibility rule. Reasons not
 * listed here (malformed id/type, a section child of the wrong type, a
 * nesting/circular-dependency problem) have no single control to point at
 * and only ever show up as the field-level banner and canvas badge.
 */
const FIELD_LEVEL_REASON_TAB = {
  field_label_required: "labels",
  options_required: "labels",
  cascading_parent_field_id_not_found: "labels",
  cascading_parent_field_id_self_reference: "labels",
  computed_formula_not_logic: "labels",
  computed_formula_too_large: "labels",
  computed_formula_too_deep: "labels",
  computed_formula_not_serializable: "labels",
  visibility_condition_not_logic: "visibility",
  visibility_condition_too_large: "visibility",
  visibility_condition_too_deep: "visibility",
  visibility_condition_not_serializable: "visibility",
};

/**
 * Index segments like fields[2] or .children[1], in encounter order - used
 * to walk down to the exact field a backend error path refers to.
 */
function parse_index_path(path) {
  const matches = [...path.matchAll(/(?:^fields|\.children)\[(\d+)\]/g)];
  return matches.map((match) => Number(match[1]));
}

/**
 * Whatever comes after the last fields[n]/children[n] segment - e.g.
 * ".validation_rules[0]" or ".options[2]" or "" for a field-level error.
 */
function get_path_suffix(path) {
  const matches = [...path.matchAll(/(?:fields|children)\[(\d+)\]/g)];
  if (matches.length === 0) return "";
  const last_match = matches[matches.length - 1];
  return path.slice(last_match.index + last_match[0].length);
}

function resolve_field_by_index_path(fields, index_path) {
  let current_list = fields;
  let current_field = null;
  for (let depth = 0; depth < index_path.length; depth += 1) {
    const index = index_path[depth];
    if (!Array.isArray(current_list) || !current_list[index]) return null;
    current_field = current_list[index];
    current_list = current_field.children;
  }
  return current_field;
}

function empty_field_entry() {
  return { messages: [], tabs_with_errors: new Set(), tab_messages: {}, rule_errors: {}, option_errors: {} };
}

function add_message(entry, message) {
  entry.messages.push(message);
}

function add_tab_message(entry, tab, reason, message) {
  entry.tabs_with_errors.add(tab);
  entry.tab_messages[tab] = (entry.tab_messages[tab] || []).concat([{ reason, message }]);
}

function add_indexed_message(entry, bucket_name, tab, index, message) {
  entry.tabs_with_errors.add(tab);
  entry[bucket_name][index] = (entry[bucket_name][index] || []).concat([message]);
}

/**
 * Turns the raw {path, reason} list a failed publish returns into a
 * per-field index the builder canvas and settings drawer can look up in
 * O(1): which fields have a problem, which of the drawer's tabs it lives
 * on, and - where the error is specific enough - exactly which validation
 * rule or option it belongs to, each with an already human-readable
 * message. Resolves purely against the CURRENT field tree (by walking the
 * same positional path the backend reported), so it stays correct if the
 * user has reordered/added/removed fields since that publish attempt -
 * an error whose position no longer resolves is simply dropped rather than
 * misattributed to the wrong field.
 */
export function build_schema_error_index(errors, fields, translate) {
  const by_field_id = new Map();

  const get_entry = (field_id) => {
    if (!by_field_id.has(field_id)) by_field_id.set(field_id, empty_field_entry());
    return by_field_id.get(field_id);
  };

  (errors || []).forEach((error) => {
    if (!error || typeof error.path !== "string") return;
    const message = humanize_schema_error_reason(error.reason, translate);

    if (error.reason === "circular_dependency" && Array.isArray(error.fields)) {
      error.fields.forEach((field_id) => add_message(get_entry(field_id), message));
      return;
    }

    const index_path = parse_index_path(error.path);
    if (index_path.length === 0) return;
    const resolved_field = resolve_field_by_index_path(fields, index_path);
    if (!resolved_field) return;

    const entry = get_entry(resolved_field.id);
    add_message(entry, message);

    const suffix = get_path_suffix(error.path);
    const rule_match = suffix.match(VALIDATION_RULE_SUFFIX_RE);
    const option_match = suffix.match(OPTION_SUFFIX_RE);

    if (rule_match) {
      add_indexed_message(entry, "rule_errors", "validation", Number(rule_match[1]), message);
    } else if (option_match) {
      add_indexed_message(entry, "option_errors", "labels", Number(option_match[1]), message);
    } else if (SECTION_LAYOUT_SUFFIX_RE.test(suffix)) {
      // No drawer control edits section_layout directly (it's authored by
      // dragging on the canvas) - field-level message/badge only.
    } else if (FIELD_LEVEL_REASON_TAB[error.reason]) {
      add_tab_message(entry, FIELD_LEVEL_REASON_TAB[error.reason], error.reason, message);
    }
  });

  return by_field_id;
}

/**
 * Looks up one field's error entry, always returning the same shape (empty
 * arrays/sets rather than undefined) so callers never need a null-check.
 */
export function get_field_error_entry(by_field_id, field_id) {
  return (by_field_id && by_field_id.get(field_id)) || empty_field_entry();
}
