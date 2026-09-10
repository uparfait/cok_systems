import { get_applicable_operators, build_validation_condition } from "./validationOperators.js";
import { get_field_text } from "../fields/fieldText.js";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";

/**
 * Which field types a field may be turned into without losing what it has
 * already collected. Only pairs that store the same kind of answer are
 * here: number and text both hold one scalar, and single_select (radio
 * rows) and select_group (a dropdown) are the same one-of-many question
 * wearing two different controls.
 */
export const DCS_FIELD_CONVERSIONS = {
  number: ["text"],
  text: ["number"],
  single_select: ["select_group"],
  select_group: ["single_select"],
};

export function conversion_targets(field_type) {
  return DCS_FIELD_CONVERSIONS[field_type] || [];
}

// Operators that can only ever mean something against a number. A field
// another field compares this way cannot be handed a non-numeric type
// underneath it without that comparison quietly becoming nonsense.
const NUMERIC_ONLY_OPERATORS = ["less_than", "greater_than", "min_value", "max_value", "multiple_of"];

function is_numeric_type(field_type) {
  return field_type === "number" || field_type === "duration" || field_type === "likert_scale";
}

function applicable_operator_ids(field_type) {
  return get_applicable_operators(field_type).map((operator) => operator.id);
}

function operator_label_key(operator_id) {
  return `OP_${String(operator_id).toUpperCase()}`;
}

/**
 * The field's own validation rules that the target type has no operator
 * for - the author has to delete these in the Validation tab first, since
 * silently dropping a rule they wrote is never this feature's call.
 */
function own_rule_blockers(field, target_type) {
  const allowed_ids = applicable_operator_ids(target_type);
  return (field.validation_rules || [])
    .filter((rule) => rule.operator && !allowed_ids.includes(rule.operator))
    .map((rule) => ({
      kind: "own_rule",
      message_key: "DCS_CONVERT_BLOCKER_OWN_RULE",
      field_id: field.id,
      tab: "validation",
      message_vars: { operator: { translate_key: operator_label_key(rule.operator) } },
    }));
}

/**
 * Everywhere ELSE in the form that reads this field numerically: another
 * field's validation rule, one of its parent-driven option groups, or its
 * visibility condition. Each one names the field to go and open, because
 * the setting to remove does not live on the field being converted.
 */
function dependent_blockers(field, all_fields, target_type, language) {
  if (is_numeric_type(target_type)) return [];

  const blockers = [];
  const label_of = (candidate) => get_field_text(candidate.label, language) || candidate.id;

  flatten_fields(all_fields || []).forEach((candidate) => {
    if (!candidate || candidate.id === field.id) return;

    (candidate.validation_rules || []).forEach((rule) => {
      if (rule.parent_field_id === field.id && NUMERIC_ONLY_OPERATORS.includes(rule.operator)) {
        blockers.push({
          kind: "dependent_rule",
          message_key: "DCS_CONVERT_BLOCKER_DEPENDENT_RULE",
          field_id: candidate.id,
          message_vars: { label: label_of(candidate), operator: { translate_key: operator_label_key(rule.operator) } },
        });
      }
    });

    (candidate.parent_option_groups || []).forEach((group) => {
      if (group.parent_field_id === field.id && NUMERIC_ONLY_OPERATORS.includes(group.operator)) {
        blockers.push({
          kind: "option_group",
          message_key: "DCS_CONVERT_BLOCKER_OPTION_GROUP",
          field_id: candidate.id,
          message_vars: { label: label_of(candidate), operator: { translate_key: operator_label_key(group.operator) } },
        });
      }
    });

    const visibility = candidate.visibility_condition_ui;
    if (visibility && visibility.parent_field_id === field.id && NUMERIC_ONLY_OPERATORS.includes(visibility.operator)) {
      blockers.push({
        kind: "visibility",
        message_key: "DCS_CONVERT_BLOCKER_VISIBILITY",
        field_id: candidate.id,
        message_vars: { label: label_of(candidate), operator: { translate_key: operator_label_key(visibility.operator) } },
      });
    }
  });

  return blockers;
}

/**
 * Everything standing between this field and the requested type. An empty
 * list means the conversion is safe to run: converting between the two
 * select controls always is, since they share one option model and one
 * operator set.
 */
export function find_conversion_blockers(field, target_type, all_fields, language) {
  if (!field || !conversion_targets(field.type).includes(target_type)) return [];
  return own_rule_blockers(field, target_type).concat(dependent_blockers(field, all_fields, target_type, language));
}

/**
 * The converted field. Rules the target type still understands are kept
 * but have their JSONLogic condition rebuilt, because how a condition is
 * compiled depends on the field's type - a rule left holding the old
 * type's condition would be enforced against a value shape that no longer
 * exists. Callers must check find_conversion_blockers first; anything it
 * reports would be dropped here.
 */
export function convert_field_type(field, target_type) {
  const allowed_ids = applicable_operator_ids(target_type);
  const kept_rules = (field.validation_rules || [])
    .filter((rule) => !rule.operator || allowed_ids.includes(rule.operator))
    .map((rule) =>
      Object.assign({}, rule, {
        condition: build_validation_condition(field.id, rule.operator, rule.value, rule.parent_field_id, rule.parent_value, target_type),
      }),
    );

  return Object.assign({}, field, { type: target_type, validation_rules: kept_rules });
}
