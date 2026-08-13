const { evaluate_rule } = require("./engine.js");
const { flatten_fields, build_dependency_graph } = require("./dependency_graph.js");
const { translate } = require("../i18n/index.js");

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

  const working_data = Object.assign({}, submitted_data);
  const field_errors = {};

  const evaluation_order = dependency_result.order.length > 0 ? dependency_result.order : [...fields_by_id.keys()];

  evaluation_order.forEach((field_id) => {
    const field = fields_by_id.get(field_id);
    if (!field || !field.type) return;

    if (field.computed && field.computed.enabled && field.computed.formula) {
      const computed_result = evaluate_rule(field.computed.formula, working_data);
      working_data[field_id] = computed_result.value;
    }

    const visibility_result = field.visibility_condition
      ? evaluate_rule(field.visibility_condition, working_data)
      : { value: true, error: null };
    const is_visible = visibility_result.error ? true : visibility_result.value !== false;

    if (!is_visible) return;

    if (field.mandatory && is_empty_value(working_data[field_id])) {
      field_errors[field_id] = (field_errors[field_id] || []).concat([
        pick_translated_message(field.required_message, language) || translate("VALIDATION_FIELD_REQUIRED", language),
      ]);
    }

    (field.validation_rules || []).forEach((validation_rule) => {
      if (!validation_rule.condition) return;
      const rule_result = evaluate_rule(validation_rule.condition, working_data);
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
