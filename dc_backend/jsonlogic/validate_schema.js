const { ALL_FIELD_TYPES, CONTENT_FIELD_TYPES, SUPPORTED_LANGUAGES } = require("../constants/field_types.js");
const config = require("../configurations/config.js");

const LABEL_NOT_REQUIRED_TYPES = CONTENT_FIELD_TYPES.concat(["hidden"]);
const { is_valid_rule_structure } = require("./engine.js");
const { build_dependency_graph } = require("./dependency_graph.js");

const MAX_NESTING_DEPTH = config.max_group_nesting_depth;

const OPTION_BASED_TYPES = ["single_select", "multi_select", "ranking", "select_group", "cascading_select"];

// Mirrors frontend/src/systems/dcs/builder/validationOperators.js exactly -
// keep both in sync whenever an operator or its type applicability changes.
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

const ALL_OPERATOR_IDS = new Set([
  ...TEXT_OPERATOR_IDS, ...EMAIL_OPERATOR_IDS, ...URL_OPERATOR_IDS, ...PHONE_OPERATOR_IDS,
  ...NUMBER_OPERATOR_IDS, ...LIKERT_OPERATOR_IDS, ...RANKING_OPERATOR_IDS, ...DATE_OPERATOR_IDS,
  ...TIME_OPERATOR_IDS, ...MEDIA_OPERATOR_IDS, ...SINGLE_CHOICE_OPERATOR_IDS, ...MULTI_CHOICE_OPERATOR_IDS,
  ...DEFAULT_OPERATOR_IDS, "greater_than", "less_than",
]);

/**
 * Maps a field type to the operator ids that actually make sense for it -
 * same rule table the builder's settings drawer uses to decide which
 * operators to even offer, applied here so a hand-authored or pasted-in
 * schema can never smuggle in a nonsensical pairing (e.g. a file-size check
 * on a text field) that the UI itself would never let an author create.
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
 * True when a translated-label object carries at least one non-empty value
 * in a supported language.
 */
function has_any_translation(translated_object) {
  if (!translated_object || typeof translated_object !== "object") return false;
  return SUPPORTED_LANGUAGES.some((lang) => (translated_object[lang] || "").toString().trim().length > 0);
}

/**
 * Validates a choice-based field's own options: a non-empty array, each
 * with a non-blank, unique (within this field) value - the exact
 * duplicate-value shape that once made single_select "always select the
 * first option" client-side, now refused at the door instead of merely
 * worked around in the renderer.
 */
function validate_options(field, path, errors) {
  if (!Array.isArray(field.options) || field.options.length === 0) {
    errors.push({ path, reason: "options_required" });
    return;
  }

  const seen_values = new Set();
  field.options.forEach((option, index) => {
    const option_path = `${path}.options[${index}]`;
    if (!option || typeof option !== "object") {
      errors.push({ path: option_path, reason: "option_not_object" });
      return;
    }
    if (!option.id || typeof option.id !== "string") {
      errors.push({ path: option_path, reason: "option_id_required" });
    }
    const value = option.value;
    if (value === undefined || value === null || value.toString().trim().length === 0) {
      errors.push({ path: option_path, reason: "option_value_required" });
    } else if (seen_values.has(value)) {
      errors.push({ path: option_path, reason: "duplicate_option_value" });
    } else {
      seen_values.add(value);
    }
  });
}

/**
 * Validates one child's section_layout - required on every direct child of
 * a section (never on a group's children, which stack normally instead).
 */
function validate_section_layout(child, path, errors) {
  const layout = child && child.section_layout;
  if (!layout || typeof layout !== "object") {
    errors.push({ path, reason: "section_layout_required" });
    return;
  }
  ["x_percent", "y_percent", "width_percent", "height_percent"].forEach((key) => {
    const value = layout[key];
    if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 100) {
      errors.push({ path: `${path}.section_layout`, reason: `section_layout_${key}_invalid` });
    }
  });
}

/**
 * Collects every field id anywhere in the tree, tolerating whatever
 * malformed shapes a hand-authored or pasted-in schema might contain (a
 * null entry, a non-object, a missing id) - this runs before validate_field
 * has had a chance to flag those same problems, so it must never throw on
 * exactly the input validate_field exists to catch.
 */
function collect_all_field_ids(fields, accumulator) {
  const ids = accumulator || new Set();
  (Array.isArray(fields) ? fields : []).forEach((field) => {
    if (!field || typeof field !== "object") return;
    if (typeof field.id === "string") ids.add(field.id);
    if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
      collect_all_field_ids(field.children, ids);
    }
  });
  return ids;
}

/**
 * Validates one field definition (and, for groups/sections, its children)
 * and appends any problems found to the errors array. all_ids is the
 * complete set of every field id anywhere in the schema, collected up
 * front, so a forward-referencing cascading_select parent (or any other
 * cross-field reference) resolves correctly regardless of array order.
 */
function validate_field(field, path, depth, errors, seen_ids, all_ids) {
  if (depth > MAX_NESTING_DEPTH) {
    errors.push({ path, reason: "nesting_too_deep" });
    return;
  }

  if (!field || typeof field !== "object") {
    errors.push({ path, reason: "field_not_object" });
    return;
  }

  if (!field.id || typeof field.id !== "string") {
    errors.push({ path, reason: "field_id_required" });
  } else if (seen_ids.has(field.id)) {
    errors.push({ path, reason: "duplicate_field_id" });
  } else {
    seen_ids.add(field.id);
  }

  if (!ALL_FIELD_TYPES.includes(field.type)) {
    errors.push({ path, reason: "field_type_invalid" });
  }

  if (!LABEL_NOT_REQUIRED_TYPES.includes(field.type) && !has_any_translation(field.label)) {
    errors.push({ path, reason: "field_label_required" });
  }

  if (field.visibility_condition) {
    const check = is_valid_rule_structure(field.visibility_condition);
    if (!check.valid) errors.push({ path, reason: `visibility_condition_${check.reason}` });
  }

  if (field.computed && field.computed.enabled) {
    const check = is_valid_rule_structure(field.computed.formula);
    if (!check.valid) errors.push({ path, reason: `computed_formula_${check.reason}` });
  }

  (field.validation_rules || []).forEach((validation_rule, index) => {
    const rule_path = `${path}.validation_rules[${index}]`;
    if (!validation_rule || typeof validation_rule !== "object") {
      errors.push({ path: rule_path, reason: "validation_rule_not_object" });
      return;
    }
    // operator is optional provenance metadata (which builder dropdown
    // authored this rule) - only condition is ever evaluated at submission
    // time, so a rule built directly from a raw condition (no operator) is
    // legitimate and must not be rejected. When an operator IS given, it
    // must be a real, recognized id that actually applies to this field's
    // type.
    if (validation_rule.operator !== undefined && validation_rule.operator !== null) {
      if (!ALL_OPERATOR_IDS.has(validation_rule.operator)) {
        errors.push({ path: rule_path, reason: "validation_operator_invalid" });
      } else if (!get_applicable_operator_ids(field.type).includes(validation_rule.operator)) {
        errors.push({ path: rule_path, reason: "validation_operator_not_applicable_to_field_type" });
      }
    }
    if (validation_rule.condition) {
      const check = is_valid_rule_structure(validation_rule.condition);
      if (!check.valid) errors.push({ path: rule_path, reason: `condition_${check.reason}` });
    }
    if (!has_any_translation(validation_rule.message)) {
      errors.push({ path: rule_path, reason: "validation_message_required" });
    }
  });

  if (OPTION_BASED_TYPES.includes(field.type)) {
    validate_options(field, path, errors);
  }

  if (field.type === "cascading_select" && field.parent_field_id) {
    if (typeof field.parent_field_id !== "string" || !all_ids.has(field.parent_field_id)) {
      errors.push({ path, reason: "cascading_parent_field_id_not_found" });
    } else if (field.parent_field_id === field.id) {
      errors.push({ path, reason: "cascading_parent_field_id_self_reference" });
    }
  }

  if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
    field.children.forEach((child, index) => {
      const child_path = `${path}.children[${index}]`;
      if (field.type === "section") {
        const child_type = child && child.type;
        if (!CONTENT_FIELD_TYPES.includes(child_type) || child_type === "section") {
          errors.push({ path: child_path, reason: "section_child_type_not_allowed" });
        }
        validate_section_layout(child, child_path, errors);
      }
      validate_field(child, child_path, depth + 1, errors, seen_ids, all_ids);
    });
  }
}

/**
 * Server-side structural validation of an entire form schema: field types,
 * translated labels, JSONLogic rule structures, nesting depth, computed
 * field circular dependencies, choice-field options and cross-field
 * references. This runs on every create/update so a broken schema - whether
 * hand-authored or pasted in from an externally generated form - can never
 * reach the database.
 */
function validate_form_schema(schema) {
  const errors = [];

  if (!schema || !Array.isArray(schema.fields)) {
    errors.push({ path: "fields", reason: "fields_must_be_array" });
    return { valid: false, errors };
  }

  const all_ids = collect_all_field_ids(schema.fields);

  const seen_ids = new Set();
  schema.fields.forEach((field, index) => validate_field(field, `fields[${index}]`, 0, errors, seen_ids, all_ids));

  if (errors.length === 0) {
    const dependency_result = build_dependency_graph(schema.fields);
    if (dependency_result.has_cycle) {
      errors.push({ path: "fields", reason: "circular_dependency", fields: dependency_result.cyclic_fields });
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validate_form_schema,
  has_any_translation,
};
