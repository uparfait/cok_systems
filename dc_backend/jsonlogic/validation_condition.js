/**
 * Server-side mirror of build_validation_condition in
 * frontend/src/systems/dcs/builder/validationOperators.js - keep both in
 * sync. Used to REBUILD a rule's JSONLogic condition from its operator
 * metadata at evaluation time: a stored condition can be stale (authored by
 * an older builder, or copied along with a duplicated field so its var
 * still points at the original field), and rebuilding from the operator
 * plus the CURRENT field id guarantees the rule enforced is exactly the
 * rule the author sees configured.
 */

const FILE_SIZE_MULTIPLIERS = {
  max_file_size_kb: 1024,
  max_file_size_mb: 1024 * 1024,
  max_file_size_gb: 1024 * 1024 * 1024,
};

function duration_total_minutes_var(field_id) {
  return { "+": [{ "*": [{ var: `${field_id}.hours` }, 60] }, { var: `${field_id}.minutes` }] };
}

const NUMERIC_VALUE_OPERATORS = new Set([
  "length_is", "min_length", "max_length", "words_is", "min_words", "max_words",
  "greater_than", "less_than", "min_value", "max_value", "multiple_of",
  "min_selections", "max_selections", "exact_selections",
  "max_file_size_mb", "max_file_size_kb", "max_file_size_gb",
]);

function build_validation_condition(field_id, operator_id, value, parent_field_id, parent_value, field_type) {
  const field_var = field_type === "duration" ? duration_total_minutes_var(field_id) : { var: field_id };
  const is_time_bound = field_type === "time" && (operator_id === "min_value" || operator_id === "max_value");
  const numeric_value = is_time_bound ? value : Number(value);
  // A numeric operator whose authored value cannot be read as a number
  // would rebuild into a NaN comparison that fails everything - refuse to
  // build instead, so the caller falls back to the stored condition.
  if (!is_time_bound && NUMERIC_VALUE_OPERATORS.has(operator_id) && !Number.isFinite(numeric_value)) {
    return null;
  }

  switch (operator_id) {
    case "equals":
      return { "==": [field_var, value] };
    case "not_equals":
      return { "!=": [field_var, value] };
    case "includes":
      return { in_array: [value, field_var] };
    case "not_includes":
      return { not_in_array: [value, field_var] };
    case "starts_with":
      return { starts_with: [field_var, value] };
    case "ends_with":
      return { ends_with: [field_var, value] };
    case "length_is":
      return { length_is: [field_var, numeric_value] };
    case "min_length":
      return { min_length: [field_var, numeric_value] };
    case "max_length":
      return { max_length: [field_var, numeric_value] };
    case "words_is":
      return { words_is: [field_var, numeric_value] };
    case "min_words":
      return { min_words: [field_var, numeric_value] };
    case "max_words":
      return { max_words: [field_var, numeric_value] };
    case "matches_pattern":
      return { regex_match: [field_var, value] };
    case "not_matches_pattern":
      return { "!": [{ regex_match: [field_var, value] }] };
    case "greater_than":
      return { ">": [field_var, numeric_value] };
    case "less_than":
      return { "<": [field_var, numeric_value] };
    case "min_value":
      return { ">=": [field_var, numeric_value] };
    case "max_value":
      return { "<=": [field_var, numeric_value] };
    case "multiple_of":
      return { "==": [{ "%": [field_var, numeric_value] }, 0] };
    case "is_integer":
      return { "==": [{ "%": [field_var, 1] }, 0] };
    case "is_positive":
      return { ">": [field_var, 0] };
    case "is_negative":
      return { "<": [field_var, 0] };
    case "min_date":
      return { ">=": [field_var, value] };
    case "max_date":
      return { "<=": [field_var, value] };
    case "min_selections":
      return { min_length: [field_var, numeric_value] };
    case "max_selections":
      return { max_length: [field_var, numeric_value] };
    case "exact_selections":
      return { length_is: [field_var, numeric_value] };
    case "email_domain_in":
      return { email_domain_in: [field_var, value] };
    case "email_domain_not_in":
      return { email_domain_not_in: [field_var, value] };
    case "url_domain_in":
      return { url_domain_in: [field_var, value] };
    case "url_domain_not_in":
      return { url_domain_not_in: [field_var, value] };
    case "must_equal_field":
      return { "==": [field_var, { var: parent_field_id }] };
    case "not_equal_field":
      return { "!=": [field_var, { var: parent_field_id }] };
    case "max_file_size_mb":
    case "max_file_size_kb":
    case "max_file_size_gb":
      return { "<=": [{ var: `${field_id}.size` }, numeric_value * FILE_SIZE_MULTIPLIERS[operator_id]] };
    case "depends_on_parent":
      return {
        if: [{ "==": [{ var: parent_field_id }, parent_value] }, { "==": [field_var, value] }, true],
      };
    default:
      return null;
  }
}

/**
 * The condition a rule should ACTUALLY be judged by: rebuilt from the
 * rule's operator metadata against the field as it stands today; a rule
 * without operator metadata (hand-authored raw condition) keeps its stored
 * condition untouched.
 */
function effective_rule_condition(field, rule) {
  if (!rule) return null;
  if (!rule.operator) return rule.condition || null;
  const rebuilt = build_validation_condition(field.id, rule.operator, rule.value, rule.parent_field_id, rule.parent_value, field.type);
  return rebuilt || rule.condition || null;
}

module.exports = {
  build_validation_condition,
  effective_rule_condition,
};
