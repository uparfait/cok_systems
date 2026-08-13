import { evaluate_rule } from "../jsonlogic/engine.js";
import { build_dependency_graph, flatten_fields } from "../jsonlogic/dependencyGraph.js";

/**
 * True when a field should currently be shown, given the rest of the
 * answers so far. Fields without a visibility_condition are always shown.
 * A rule evaluation error fails open (visible), mirroring the server.
 */
export function evaluate_field_visibility(field, values) {
  if (!field.visibility_condition) return true;
  const result = evaluate_rule(field.visibility_condition, values || {});
  return result.error ? true : result.value !== false;
}

/**
 * Recomputes every enabled computed field's value, in dependency-safe
 * order, so hidden/derived fields always reflect the latest answers - used
 * identically on the client as the server uses at submission time.
 */
export function compute_derived_values(schema, values) {
  const flat_fields = flatten_fields(schema.fields);
  const fields_by_id = new Map(flat_fields.map((field) => [field.id, field]));
  const dependency_result = build_dependency_graph(schema.fields);
  const evaluation_order = dependency_result.order.length > 0 ? dependency_result.order : [...fields_by_id.keys()];

  const working_values = Object.assign({}, values);

  evaluation_order.forEach((field_id) => {
    const field = fields_by_id.get(field_id);
    if (!field || !field.computed || !field.computed.enabled || !field.computed.formula) return;
    const result = evaluate_rule(field.computed.formula, working_values);
    working_values[field_id] = result.value;
  });

  return working_values;
}
