const { extract_variable_references } = require("./engine.js");

/**
 * Flattens a (possibly nested, group-containing) field list into a single
 * array, so computed/visibility rules can reference fields living inside
 * groups just as easily as top-level fields.
 */
function flatten_fields(fields, accumulator) {
  const flat = accumulator || [];
  (fields || []).forEach((field) => {
    flat.push(field);
    if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
      flatten_fields(field.children, flat);
    }
  });
  return flat;
}

/**
 * Maps every field id to its containing group/section's id (or null for a
 * top-level field) - mirrors build_field_parent_map in
 * frontend/src/systems/dcs/jsonlogic/dependencyGraph.js, keep both in sync.
 * A field's own visibility_condition only ever describes itself, so a
 * mandatory check must also walk this chain: a group/section can be hidden
 * by its own visibility_condition while a child field living inside it has
 * no visibility_condition of its own at all, and was never meant to be
 * answerable in that state either.
 */
function build_field_parent_map(fields, parent_id, accumulator) {
  const map = accumulator || new Map();
  (fields || []).forEach((field) => {
    map.set(field.id, parent_id || null);
    if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
      build_field_parent_map(field.children, field.id, map);
    }
  });
  return map;
}

/**
 * True when every ancestor group/section of a field (per parent_map) is
 * itself visible, given each field's own visibility (own_visible_by_id,
 * keyed by field id) - does not consider the field's own visibility, only
 * its ancestors', since callers already have the field's own flag on hand.
 */
function is_visible_through_ancestors(field_id, parent_map, own_visible_by_id) {
  let current_id = parent_map.get(field_id);
  while (current_id) {
    if (own_visible_by_id.get(current_id) === false) return false;
    current_id = parent_map.get(current_id);
  }
  return true;
}

/**
 * Builds the set of field ids that a given field's rules depend on.
 */
function collect_field_dependencies(field) {
  const dependencies = new Set();
  extract_variable_references(field.visibility_condition || null).forEach((ref) => dependencies.add(ref));
  if (field.computed && field.computed.enabled) {
    extract_variable_references(field.computed.formula || null).forEach((ref) => dependencies.add(ref));
  }
  (field.validation_rules || []).forEach((validation_rule) => {
    extract_variable_references(validation_rule.condition || null).forEach((ref) => dependencies.add(ref));
  });
  return dependencies;
}

/**
 * Builds a dependency graph across every field in the form and returns a
 * safe evaluation order via topological sort (Kahn's algorithm). When a
 * cycle exists, has_cycle is true and cyclic_fields lists the offending ids
 * so the caller can reject the schema with a precise error.
 */
function build_dependency_graph(fields) {
  const flat_fields = flatten_fields(fields);
  const node_ids = new Set(flat_fields.map((field) => field.id));

  const depends_on = new Map();
  flat_fields.forEach((field) => {
    const dependencies = collect_field_dependencies(field);
    const valid_dependencies = new Set([...dependencies].filter((dep) => node_ids.has(dep) && dep !== field.id));
    depends_on.set(field.id, valid_dependencies);
  });

  const dependents_of = new Map([...node_ids].map((id) => [id, []]));
  const in_degree = new Map([...node_ids].map((id) => [id, 0]));

  depends_on.forEach((dependencies, field_id) => {
    in_degree.set(field_id, dependencies.size);
    dependencies.forEach((dependency_id) => {
      dependents_of.get(dependency_id).push(field_id);
    });
  });

  const queue = [...node_ids].filter((id) => in_degree.get(id) === 0);
  const order = [];

  while (queue.length > 0) {
    const current_id = queue.shift();
    order.push(current_id);
    dependents_of.get(current_id).forEach((dependent_id) => {
      const remaining = in_degree.get(dependent_id) - 1;
      in_degree.set(dependent_id, remaining);
      if (remaining === 0) queue.push(dependent_id);
    });
  }

  const has_cycle = order.length < node_ids.size;
  const cyclic_fields = has_cycle ? [...node_ids].filter((id) => !order.includes(id)) : [];

  return { order, has_cycle, cyclic_fields };
}

module.exports = {
  flatten_fields,
  build_dependency_graph,
  build_field_parent_map,
  is_visible_through_ancestors,
};
