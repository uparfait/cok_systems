/**
 * Every validation operator offered in the field settings drawer, and how
 * to turn a chosen operator plus its authored value(s) into the JSONLogic
 * condition that will actually be evaluated, client and server alike.
 */
export const DCS_VALIDATION_OPERATORS = [
  { id: "equals", labelKey: "OP_EQUALS", needsParent: false },
  { id: "not_equals", labelKey: "OP_NOT_EQUALS", needsParent: false },
  { id: "includes", labelKey: "OP_INCLUDES", needsParent: false },
  { id: "starts_with", labelKey: "OP_STARTS_WITH", needsParent: false },
  { id: "ends_with", labelKey: "OP_ENDS_WITH", needsParent: false },
  { id: "length_is", labelKey: "OP_LENGTH_IS", needsParent: false },
  { id: "min_length", labelKey: "OP_MIN_LENGTH", needsParent: false },
  { id: "max_length", labelKey: "OP_MAX_LENGTH", needsParent: false },
  { id: "greater_than", labelKey: "OP_GREATER_THAN", needsParent: false },
  { id: "less_than", labelKey: "OP_LESS_THAN", needsParent: false },
  { id: "max_file_size_mb", labelKey: "OP_MAX_FILE_SIZE_MB", needsParent: false },
  { id: "max_file_size_kb", labelKey: "OP_MAX_FILE_SIZE_KB", needsParent: false },
  { id: "max_file_size_gb", labelKey: "OP_MAX_FILE_SIZE_GB", needsParent: false },
  { id: "depends_on_parent", labelKey: "OP_DEPENDS_ON_PARENT", needsParent: true },
];

const TEXT_LIKE_TYPES = ["text", "email", "url", "phone"];
const NUMBER_LIKE_TYPES = ["number", "duration"];
const DATE_LIKE_TYPES = ["date", "time", "date_time"];
const MEDIA_TYPES = ["image", "video", "audio", "file_upload"];
const CHOICE_TYPES = ["single_select", "multi_select", "cascading_select", "likert_scale", "ranking"];

const TEXT_OPERATOR_IDS = ["equals", "not_equals", "includes", "starts_with", "ends_with", "length_is", "min_length", "max_length", "depends_on_parent"];
const NUMBER_OPERATOR_IDS = ["equals", "not_equals", "greater_than", "less_than", "depends_on_parent"];
const MEDIA_OPERATOR_IDS = ["max_file_size_mb", "max_file_size_kb", "max_file_size_gb", "depends_on_parent"];
const CHOICE_OPERATOR_IDS = ["equals", "not_equals", "includes", "depends_on_parent"];
const DEFAULT_OPERATOR_IDS = ["equals", "not_equals", "depends_on_parent"];

/**
 * Maps a field type to the operator ids that actually make sense for it, so
 * a text field is never offered a file-size check and a file upload is
 * never offered a "starts with" check.
 */
function get_applicable_operator_ids(field_type) {
  if (TEXT_LIKE_TYPES.includes(field_type)) return TEXT_OPERATOR_IDS;
  if (NUMBER_LIKE_TYPES.includes(field_type)) return NUMBER_OPERATOR_IDS;
  if (DATE_LIKE_TYPES.includes(field_type)) return NUMBER_OPERATOR_IDS;
  if (MEDIA_TYPES.includes(field_type)) return MEDIA_OPERATOR_IDS;
  if (CHOICE_TYPES.includes(field_type)) return CHOICE_OPERATOR_IDS;
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
      return { in: [value, field_var] };
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
    case "greater_than":
      return { ">": [field_var, numeric_value] };
    case "less_than":
      return { "<": [field_var, numeric_value] };
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
