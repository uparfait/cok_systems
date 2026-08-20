/**
 * Every validation operator offered in the field settings drawer, and how
 * to turn a chosen operator plus its authored value(s) into the JSONLogic
 * condition that will actually be evaluated, client and server alike.
 *
 * needsValue: shows the generic "Value" input.
 * needsParent: shows a sibling-field selector.
 * needsParentValue: (only when needsParent) also shows a second value input
 * for what the parent field must equal.
 */
export const DCS_VALIDATION_OPERATORS = [
  { id: "equals", labelKey: "OP_EQUALS", needsValue: true },
  { id: "not_equals", labelKey: "OP_NOT_EQUALS", needsValue: true },
  { id: "includes", labelKey: "OP_INCLUDES", needsValue: true },
  { id: "not_includes", labelKey: "OP_NOT_INCLUDES", needsValue: true },
  { id: "starts_with", labelKey: "OP_STARTS_WITH", needsValue: true },
  { id: "ends_with", labelKey: "OP_ENDS_WITH", needsValue: true },
  {
    id: "length_is",
    labelKey: "OP_LENGTH_IS",
    needsValue: true,
    invalidMessageLabelKey: "DCS_SETTINGS_LENGTH_EXACT_INVALID_MESSAGE",
    validMessageLabelKey: "DCS_SETTINGS_LENGTH_VALID_MESSAGE",
  },
  {
    id: "min_length",
    labelKey: "OP_MIN_LENGTH",
    needsValue: true,
    invalidMessageLabelKey: "DCS_SETTINGS_LENGTH_RANGE_INVALID_MESSAGE",
    validMessageLabelKey: "DCS_SETTINGS_LENGTH_VALID_MESSAGE",
  },
  {
    id: "max_length",
    labelKey: "OP_MAX_LENGTH",
    needsValue: true,
    invalidMessageLabelKey: "DCS_SETTINGS_LENGTH_RANGE_INVALID_MESSAGE",
    validMessageLabelKey: "DCS_SETTINGS_LENGTH_VALID_MESSAGE",
  },
  { id: "matches_pattern", labelKey: "OP_MATCHES_PATTERN", needsValue: true },
  { id: "not_matches_pattern", labelKey: "OP_NOT_MATCHES_PATTERN", needsValue: true },
  { id: "greater_than", labelKey: "OP_GREATER_THAN", needsValue: true },
  { id: "less_than", labelKey: "OP_LESS_THAN", needsValue: true },
  { id: "min_value", labelKey: "OP_MIN_VALUE", needsValue: true },
  { id: "max_value", labelKey: "OP_MAX_VALUE", needsValue: true },
  { id: "multiple_of", labelKey: "OP_MULTIPLE_OF", needsValue: true },
  { id: "is_integer", labelKey: "OP_IS_INTEGER", needsValue: false },
  { id: "is_positive", labelKey: "OP_IS_POSITIVE", needsValue: false },
  { id: "is_negative", labelKey: "OP_IS_NEGATIVE", needsValue: false },
  { id: "min_date", labelKey: "OP_MIN_DATE", needsValue: true },
  { id: "max_date", labelKey: "OP_MAX_DATE", needsValue: true },
  { id: "min_selections", labelKey: "OP_MIN_SELECTIONS", needsValue: true },
  { id: "max_selections", labelKey: "OP_MAX_SELECTIONS", needsValue: true },
  { id: "exact_selections", labelKey: "OP_EXACT_SELECTIONS", needsValue: true },
  { id: "email_domain_in", labelKey: "OP_EMAIL_DOMAIN_IN", needsValue: true },
  { id: "email_domain_not_in", labelKey: "OP_EMAIL_DOMAIN_NOT_IN", needsValue: true },
  { id: "url_domain_in", labelKey: "OP_URL_DOMAIN_IN", needsValue: true },
  { id: "url_domain_not_in", labelKey: "OP_URL_DOMAIN_NOT_IN", needsValue: true },
  { id: "must_equal_field", labelKey: "OP_MUST_EQUAL_FIELD", needsValue: false, needsParent: true, needsParentValue: false },
  { id: "not_equal_field", labelKey: "OP_NOT_EQUAL_FIELD", needsValue: false, needsParent: true, needsParentValue: false },
  { id: "max_file_size_mb", labelKey: "OP_MAX_FILE_SIZE_MB", needsValue: true },
  { id: "max_file_size_kb", labelKey: "OP_MAX_FILE_SIZE_KB", needsValue: true },
  { id: "max_file_size_gb", labelKey: "OP_MAX_FILE_SIZE_GB", needsValue: true },
  { id: "depends_on_parent", labelKey: "OP_DEPENDS_ON_PARENT", needsValue: true, needsParent: true, needsParentValue: true },
];

const TEXT_LIKE_TYPES = ["text"];
const EMAIL_TYPES = ["email"];
const URL_TYPES = ["url"];
const PHONE_TYPES = ["phone"];
const NUMBER_LIKE_TYPES = ["number", "duration"];
const LIKERT_TYPES = ["likert_scale"];
const RANKING_TYPES = ["ranking"];
const DATE_LIKE_TYPES = ["date", "date_time"];
const TIME_TYPES = ["time"];
const MEDIA_TYPES = ["image", "video", "audio", "file_upload", "signature"];
const SINGLE_CHOICE_TYPES = ["single_select", "cascading_select", "select_group"];
const MULTI_CHOICE_TYPES = ["multi_select"];

const TEXT_OPERATOR_IDS = [
  "equals", "not_equals", "includes", "not_includes", "starts_with", "ends_with",
  "length_is", "min_length", "max_length", "matches_pattern", "not_matches_pattern",
  "must_equal_field", "not_equal_field", "depends_on_parent",
];
const EMAIL_OPERATOR_IDS = [
  "equals", "not_equals", "matches_pattern", "max_length",
  "email_domain_in", "email_domain_not_in", "must_equal_field", "depends_on_parent",
];
const URL_OPERATOR_IDS = [
  "equals", "not_equals", "starts_with", "ends_with", "matches_pattern", "max_length",
  "url_domain_in", "url_domain_not_in", "depends_on_parent",
];
const PHONE_OPERATOR_IDS = [
  "equals", "not_equals", "matches_pattern", "min_length", "max_length",
  "must_equal_field", "depends_on_parent",
];
const NUMBER_OPERATOR_IDS = [
  "equals", "not_equals", "min_value", "max_value", "multiple_of",
  "is_integer", "is_positive", "is_negative",
  "length_is", "min_length", "max_length", "starts_with", "ends_with",
  "depends_on_parent",
];
const LIKERT_OPERATOR_IDS = ["min_value", "max_value", "not_equals", "depends_on_parent"];
const RANKING_OPERATOR_IDS = ["min_selections", "max_selections", "exact_selections", "depends_on_parent"];
const DATE_OPERATOR_IDS = ["min_date", "max_date", "depends_on_parent"];
const TIME_OPERATOR_IDS = ["min_value", "max_value", "depends_on_parent"];
const MEDIA_OPERATOR_IDS = ["max_file_size_mb", "max_file_size_kb", "max_file_size_gb", "depends_on_parent"];
const SINGLE_CHOICE_OPERATOR_IDS = ["equals", "not_equals", "includes", "not_includes", "depends_on_parent"];
const MULTI_CHOICE_OPERATOR_IDS = ["includes", "not_includes", "min_selections", "max_selections", "exact_selections", "depends_on_parent"];
const DEFAULT_OPERATOR_IDS = ["equals", "not_equals", "depends_on_parent"];

/**
 * Maps a field type to the operator ids that actually make sense for it, so
 * a text field is never offered a file-size check and a file upload is
 * never offered a "starts with" check. Mirrors the per-type validation
 * criteria reference: text, number, email, url, phone, single/multi select,
 * likert, ranking, date/time/date-time, media and signature each get their
 * own tailored set.
 */
function get_applicable_operator_ids(field_type) {
  if (TEXT_LIKE_TYPES.includes(field_type)) return TEXT_OPERATOR_IDS;
  if (EMAIL_TYPES.includes(field_type)) return EMAIL_OPERATOR_IDS;
  if (URL_TYPES.includes(field_type)) return URL_OPERATOR_IDS;
  if (PHONE_TYPES.includes(field_type)) return PHONE_OPERATOR_IDS;
  if (NUMBER_LIKE_TYPES.includes(field_type)) return NUMBER_OPERATOR_IDS;
  if (LIKERT_TYPES.includes(field_type)) return LIKERT_OPERATOR_IDS;
  if (RANKING_TYPES.includes(field_type)) return RANKING_OPERATOR_IDS;
  if (DATE_LIKE_TYPES.includes(field_type)) return DATE_OPERATOR_IDS;
  if (TIME_TYPES.includes(field_type)) return TIME_OPERATOR_IDS;
  if (MEDIA_TYPES.includes(field_type)) return MEDIA_OPERATOR_IDS;
  if (SINGLE_CHOICE_TYPES.includes(field_type)) return SINGLE_CHOICE_OPERATOR_IDS;
  if (MULTI_CHOICE_TYPES.includes(field_type)) return MULTI_CHOICE_OPERATOR_IDS;
  return DEFAULT_OPERATOR_IDS;
}

/**
 * The subset of validation operators that are relevant to a given field
 * type (e.g. no file-size checks on a text field, no "starts with" on a
 * file upload).
 */
export function get_applicable_operators(field_type) {
  const allowed_ids = get_applicable_operator_ids(field_type);
  return DCS_VALIDATION_OPERATORS.filter((operator) => allowed_ids.includes(operator.id));
}

const FILE_SIZE_MULTIPLIERS = { max_file_size_kb: 1024, max_file_size_mb: 1024 * 1024, max_file_size_gb: 1024 * 1024 * 1024 };

/**
 * Builds the JSONLogic condition for one authored validation rule.
 */
export function build_validation_condition(field_id, operator_id, value, parent_field_id, parent_value) {
  const field_var = { var: field_id };
  const numeric_value = Number(value);

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
