const { ALL_FIELD_TYPES, CONTENT_FIELD_TYPES, SUPPORTED_LANGUAGES } = require("../constants/field_types.js");

const LABEL_NOT_REQUIRED_TYPES = CONTENT_FIELD_TYPES.concat(["hidden"]);
const { is_valid_rule_structure } = require("./engine.js");
const { build_dependency_graph } = require("./dependency_graph.js");

const MAX_NESTING_DEPTH = 6;

/**
 * True when a translated-label object carries at least one non-empty value
 * in a supported language.
 */
function has_any_translation(translated_object) {
  if (!translated_object || typeof translated_object !== "object") return false;
  return SUPPORTED_LANGUAGES.some((lang) => (translated_object[lang] || "").toString().trim().length > 0);
}

/**
 * Validates one field definition (and, for groups, its children) and
 * appends any problems found to the errors array.
 */
function validate_field(field, path, depth, errors, seen_ids) {
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
    if (validation_rule.condition) {
      const check = is_valid_rule_structure(validation_rule.condition);
      if (!check.valid) errors.push({ path: `${path}.validation_rules[${index}]`, reason: `condition_${check.reason}` });
    }
    if (!has_any_translation(validation_rule.message)) {
      errors.push({ path: `${path}.validation_rules[${index}]`, reason: "validation_message_required" });
    }
  });

  if (field.type === "group" && Array.isArray(field.children)) {
    field.children.forEach((child, index) => validate_field(child, `${path}.children[${index}]`, depth + 1, errors, seen_ids));
  }
}

/**
 * Server-side structural validation of an entire form schema: field types,
 * translated labels, JSONLogic rule structures, nesting depth and computed
 * field circular dependencies. This runs on every create/update so a broken
 * schema can never reach the database.
 */
function validate_form_schema(schema) {
  const errors = [];

  if (!schema || !Array.isArray(schema.fields)) {
    errors.push({ path: "fields", reason: "fields_must_be_array" });
    return { valid: false, errors };
  }

  const seen_ids = new Set();
  schema.fields.forEach((field, index) => validate_field(field, `fields[${index}]`, 0, errors, seen_ids));

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
