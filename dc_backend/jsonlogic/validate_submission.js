const { evaluate_rule, build_trimmed_evaluation_data } = require("./engine.js");
const { flatten_fields, build_dependency_graph, build_field_parent_map, is_visible_through_ancestors } = require("./dependency_graph.js");
const { translate } = require("../i18n/index.js");
const { file_extension_allowed } = require("../constants/file_type_groups.js");

const MEDIA_TYPES = ["image", "video", "audio", "file_upload", "signature"];
const PARENT_GROUP_CAPABLE_TYPES = ["single_select", "multi_select", "select_group"];

// Mirrors the is_locked branch of get_field_options_state in
// frontend/src/systems/dcs/fields/fieldText.js (there is no "builder" mode
// to worry about server-side) - keep both in sync whenever the
// parent-option-groups comparison logic changes.
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
 * True when a select-family field split into parent-driven condition
 * groups (field.parent_dependency_enabled) has no group currently matching
 * - the client renders nothing at all for it in that state, so it must be
 * skipped here exactly like an invisible field, or a mandatory check would
 * block submission over a question the respondent was never even shown.
 */
function is_locked_by_parent_groups(field, working_data) {
  if (!PARENT_GROUP_CAPABLE_TYPES.includes(field.type) || !field.parent_dependency_enabled) return false;
  const groups = field.parent_option_groups || [];
  return !groups.some((group) => {
    if (!group || !group.parent_field_id) return false;
    const actual_value = working_data[group.parent_field_id];
    if (!has_real_answer(actual_value)) return false;
    return evaluate_parent_group_condition(group.operator || "equals", actual_value, group.value);
  });
}

/**
 * True for anything that looks like a raw base64 data URL rather than an
 * already-uploaded file's URL - a submission must never be allowed to
 * smuggle file bytes back into MongoDB this way, regardless of what the
 * client-side upload flow was supposed to have done first.
 */
function looks_like_embedded_data_url(value) {
  return typeof value === "string" && value.startsWith("data:");
}

/**
 * Re-validates one media answer against its field's own allowed file types
 * - the same rule the upload endpoint already enforced when the file was
 * saved to disk, checked again here so a tampered submission can never
 * reference a URL for a file type the field never allowed in the first
 * place. A respondent-pasted link (is_link) has no uploaded file behind it
 * to re-check, so it is only ever screened for an embedded data URL.
 */
function validate_media_answer(field, value) {
  if (value === null || value === undefined) return null;

  if (looks_like_embedded_data_url(value)) return "SUBMISSION_FILE_EMBEDDED_NOT_ALLOWED";

  if (typeof value === "object") {
    if (value.data_url || looks_like_embedded_data_url(value.url)) return "SUBMISSION_FILE_EMBEDDED_NOT_ALLOWED";
    if (!value.is_link && value.name && !file_extension_allowed(value.name, field.allowed_file_type_groups)) {
      return "FILE_TYPE_NOT_ALLOWED";
    }
  }

  return null;
}

/**
 * True when a submitted value should be treated as empty for the purposes
 * of a mandatory-response check.
 */
function is_empty_value(value) {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return value.toString().trim().length === 0;
}

/**
 * Picks the best available translation for a field-authored message,
 * falling back across languages before falling back to a generic key.
 */
function pick_translated_message(translated_object, language) {
  if (!translated_object) return null;
  return translated_object[language] || translated_object.en || translated_object.kn || translated_object.fr || null;
}

/**
 * Resolves every computed value and every field's effective (ancestor- and
 * parent-group-aware) visibility, stripping a field's own stored answer the
 * instant it is determined hidden or locked. A respondent can answer a
 * field, then change an earlier answer that hides it (or hides its whole
 * containing group/section) without the client ever clearing the stale
 * value first - an offline-queued or hand-crafted submission is never
 * trusted to have done that cleanup itself. Clearing one field can in turn
 * change what a field further down the form should be able to see (e.g. a
 * follow-up question conditioned on the now-cleared answer), so this
 * repeats until nothing changes rather than resolving only one hop.
 */
function resolve_effective_form_state(flat_fields, fields_by_id, evaluation_order, parent_map, submitted_data) {
  const working_data = Object.assign({}, submitted_data);
  let own_visible_by_id = new Map();
  let own_locked_by_id = new Map();
  let changed = true;
  let safety_counter = 0;

  while (changed && safety_counter <= flat_fields.length) {
    changed = false;
    safety_counter += 1;
    own_visible_by_id = new Map();
    own_locked_by_id = new Map();

    evaluation_order.forEach((field_id) => {
      const field = fields_by_id.get(field_id);
      if (!field || !field.type) return;

      if (field.computed && field.computed.enabled && field.computed.formula) {
        const computed_result = evaluate_rule(field.computed.formula, build_trimmed_evaluation_data(working_data));
        working_data[field_id] = computed_result.value;
      }

      // Evaluated against a trimmed snapshot so a respondent's accidental
      // leading/trailing whitespace on an earlier answer never flips a
      // later field's visibility - the stored/returned working_data itself
      // is untouched.
      const trimmed_data = build_trimmed_evaluation_data(working_data);
      const visibility_result = field.visibility_condition
        ? evaluate_rule(field.visibility_condition, trimmed_data)
        : { value: true, error: null };
      own_visible_by_id.set(field_id, visibility_result.error ? true : visibility_result.value !== false);
      own_locked_by_id.set(field_id, is_locked_by_parent_groups(field, trimmed_data));
    });

    flat_fields.forEach((field) => {
      const field_id = field.id;
      const is_effectively_visible =
        own_visible_by_id.get(field_id) !== false && is_visible_through_ancestors(field_id, parent_map, own_visible_by_id);
      if ((!is_effectively_visible || own_locked_by_id.get(field_id)) && working_data[field_id] !== undefined) {
        delete working_data[field_id];
        changed = true;
      }
    });
  }

  return { working_data, own_visible_by_id, own_locked_by_id };
}

/**
 * Re-validates a submission on the server: computes derived (hidden)
 * field values, applies visibility conditions, enforces mandatory
 * responses and every per-field validation rule using the exact same
 * JSONLogic engine the client used. Never trusts the client's own
 * validation state.
 */
function validate_submission_data(schema, submitted_data, language) {
  const flat_fields = flatten_fields(schema.fields);
  const fields_by_id = new Map(flat_fields.map((field) => [field.id, field]));
  const dependency_result = build_dependency_graph(schema.fields);
  const parent_map = build_field_parent_map(schema.fields);

  const field_errors = {};

  // A cycle only means computed/visibility values among the cyclic fields
  // can't be resolved in a guaranteed-correct order - it must never mean
  // those fields are skipped. Silently dropping them from evaluation was
  // exactly what let a submission through while some fields' mandatory and
  // validation rules were never actually checked. Every field always gets
  // evaluated: the acyclic ones in dependency order, the cyclic ones
  // afterwards on a best-effort basis.
  const evaluation_order =
    dependency_result.order.length > 0
      ? dependency_result.order.concat(dependency_result.cyclic_fields)
      : [...fields_by_id.keys()];

  const { working_data, own_visible_by_id, own_locked_by_id } = resolve_effective_form_state(
    flat_fields,
    fields_by_id,
    evaluation_order,
    parent_map,
    submitted_data,
  );

  // A field's own visibility only ever describes itself - a group or
  // section hidden by its own visibility_condition can contain a mandatory
  // child field with no visibility_condition of its own at all, and that
  // child was never actually shown to the respondent either.
  const trimmed_data = build_trimmed_evaluation_data(working_data);
  flat_fields.forEach((field) => {
    if (!field || !field.type) return;
    const field_id = field.id;

    const is_effectively_visible =
      own_visible_by_id.get(field_id) !== false && is_visible_through_ancestors(field_id, parent_map, own_visible_by_id);

    if (!is_effectively_visible || own_locked_by_id.get(field_id)) return;

    if (field.mandatory && is_empty_value(working_data[field_id])) {
      field_errors[field_id] = (field_errors[field_id] || []).concat([
        pick_translated_message(field.required_message, language) || translate("VALIDATION_FIELD_REQUIRED", language),
      ]);
    }

    if (MEDIA_TYPES.includes(field.type)) {
      const media_error_key = validate_media_answer(field, working_data[field_id]);
      if (media_error_key) {
        field_errors[field_id] = (field_errors[field_id] || []).concat([translate(media_error_key, language)]);
      }
    }

    (field.validation_rules || []).forEach((validation_rule) => {
      if (!validation_rule.condition) return;
      const rule_result = evaluate_rule(validation_rule.condition, trimmed_data);
      const satisfied = rule_result.error ? false : rule_result.value !== false;
      if (satisfied) return;

      const severity = validation_rule.severity === "warning" ? "warning" : "error";
      field_errors[field_id] = (field_errors[field_id] || []).concat([
        {
          message: pick_translated_message(validation_rule.message, language) || translate("VALIDATION_FAILED", language),
          severity,
        },
      ]);
    });
  });

  const has_blocking_errors = Object.keys(field_errors).some((field_id) =>
    field_errors[field_id].some((entry) => typeof entry === "string" || entry.severity === "error"),
  );

  return {
    valid: !has_blocking_errors,
    field_errors,
    resolved_data: working_data,
  };
}

module.exports = {
  validate_submission_data,
};
