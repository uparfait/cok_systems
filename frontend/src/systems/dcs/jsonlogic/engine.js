import jsonLogic from "json-logic-js";
import { dcs_custom_operations } from "./customOperations.js";

const MAX_RULE_JSON_SIZE = 20000;
const MAX_RULE_DEPTH = 12;

Object.keys(dcs_custom_operations).forEach((operation_name) => {
  jsonLogic.add_operation(operation_name, dcs_custom_operations[operation_name]);
});

/**
 * Measures how many levels deep a JSONLogic rule tree goes.
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
 * Structural validation of a JSONLogic rule before it is trusted. Mirrors
 * the server-side check exactly so client and server never disagree.
 */
export function is_valid_rule_structure(rule) {
  if (rule === null || rule === undefined) return { valid: true };

  let serialized;
  try {
    serialized = JSON.stringify(rule);
  } catch (error) {
    return { valid: false, reason: "not_serializable" };
  }

  if (serialized.length > MAX_RULE_JSON_SIZE) return { valid: false, reason: "too_large" };
  if (measure_rule_depth(rule, 0) > MAX_RULE_DEPTH) return { valid: false, reason: "too_deep" };
  if (!jsonLogic.is_logic(rule) && typeof rule !== "boolean") return { valid: false, reason: "not_logic" };

  return { valid: true };
}

/**
 * Safely evaluates a JSONLogic rule against a data context. Never throws -
 * this is what drives visibility, computed fields and validation live in
 * the browser as the user fills a form.
 */
export function evaluate_rule(rule, data) {
  if (rule === null || rule === undefined) return { value: null, error: null };
  const structure_check = is_valid_rule_structure(rule);
  if (!structure_check.valid) return { value: null, error: structure_check.reason };
  try {
    return { value: jsonLogic.apply(rule, data || {}), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

/**
 * A trimmed clone of a data context, used only for evaluating conditions
 * (visibility, computed formulas, mandatory, validation rules) - never for
 * what actually gets stored or displayed. A respondent's stray leading or
 * trailing whitespace (an accidental space, a mobile keyboard's auto-space,
 * a copy-paste) must never be the reason a correct answer fails "equals",
 * "starts_with"/"ends_with", a length check, or a regex pattern - but the
 * live value must stay exactly as typed so a space the respondent is still
 * in the middle of typing (e.g. between two words) is never silently eaten
 * out from under them. Mirrors dc_backend/jsonlogic/engine.js - keep both
 * in sync.
 */
export function build_trimmed_evaluation_data(data) {
  const trimmed = {};
  Object.keys(data || {}).forEach((key) => {
    const value = data[key];
    if (typeof value === "string") {
      trimmed[key] = value.trim();
    } else if (Array.isArray(value)) {
      trimmed[key] = value.map((item) => (typeof item === "string" ? item.trim() : item));
    } else {
      trimmed[key] = value;
    }
  });
  return trimmed;
}

/**
 * Collects every "var" path referenced anywhere inside a JSONLogic rule.
 */
export function extract_variable_references(rule, accumulator) {
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
