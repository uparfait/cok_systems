const jsonLogic = require("json-logic-js");
const CUSTOM_OPERATIONS = require("./custom_operations.js");

const MAX_RULE_JSON_SIZE = 20000;
const MAX_RULE_DEPTH = 12;

Object.keys(CUSTOM_OPERATIONS).forEach((operation_name) => {
  jsonLogic.add_operation(operation_name, CUSTOM_OPERATIONS[operation_name]);
});

/**
 * Measures how many levels deep a JSONLogic rule tree goes, used to reject
 * abusively nested rules before they are ever evaluated.
 */
function measure_rule_depth(rule, current_depth) {
  const depth = current_depth || 0;
  if (depth > MAX_RULE_DEPTH) return depth;
  if (Array.isArray(rule)) {
    return rule.reduce((max_depth, item) => Math.max(max_depth, measure_rule_depth(item, depth + 1)), depth);
  }
  if (rule && typeof rule === "object") {
    return Object.values(rule).reduce(
      (max_depth, item) => Math.max(max_depth, measure_rule_depth(item, depth + 1)),
      depth,
    );
  }
  return depth;
}

/**
 * Structural validation of a JSONLogic rule before it is trusted: must be
 * plain JSON (no functions), within a size budget, and within depth limits.
 * This is what keeps rule evaluation safe without ever using eval().
 */
function is_valid_rule_structure(rule) {
  if (rule === null || rule === undefined) return { valid: true };

  let serialized;
  try {
    serialized = JSON.stringify(rule);
  } catch (error) {
    return { valid: false, reason: "not_serializable" };
  }

  if (serialized.length > MAX_RULE_JSON_SIZE) {
    return { valid: false, reason: "too_large" };
  }

  if (measure_rule_depth(rule, 0) > MAX_RULE_DEPTH) {
    return { valid: false, reason: "too_deep" };
  }

  if (!jsonLogic.is_logic(rule) && typeof rule !== "boolean") {
    return { valid: false, reason: "not_logic" };
  }

  return { valid: true };
}

/**
 * Safely evaluates a JSONLogic rule against a data context. Never throws -
 * evaluation errors are captured and returned alongside a null value so
 * callers can decide how to treat a broken rule (fail closed by default).
 */
function evaluate_rule(rule, data) {
  if (rule === null || rule === undefined) return { value: null, error: null };
  const structure_check = is_valid_rule_structure(rule);
  if (!structure_check.valid) {
    return { value: null, error: structure_check.reason };
  }
  try {
    return { value: jsonLogic.apply(rule, data || {}), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

/**
 * Collects every "var" path referenced anywhere inside a JSONLogic rule,
 * used to build the field dependency graph.
 */
function extract_variable_references(rule, accumulator) {
  const references = accumulator || [];
  if (Array.isArray(rule)) {
    rule.forEach((item) => extract_variable_references(item, references));
    return references;
  }
  if (rule && typeof rule === "object") {
    Object.keys(rule).forEach((key) => {
      if (key === "var") {
        const var_value = rule[key];
        const var_path = Array.isArray(var_value) ? var_value[0] : var_value;
        if (typeof var_path === "string" && var_path.length > 0) {
          references.push(var_path.split(".")[0]);
        }
        return;
      }
      extract_variable_references(rule[key], references);
    });
  }
  return references;
}

module.exports = {
  evaluate_rule,
  is_valid_rule_structure,
  extract_variable_references,
  MAX_RULE_DEPTH,
};
