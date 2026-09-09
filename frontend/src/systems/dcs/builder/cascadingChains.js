import { flatten_condition_fields } from "./ApprovalFlowSection.jsx";

export function parent_link_of(field, fields_by_id) {
  if (!field) return null;
  if (field.parent_field_id && fields_by_id.has(field.parent_field_id)) return field.parent_field_id;
  if (field.type === "select_group" && field.parent_dependency_enabled) {
    const group = (field.parent_option_groups || []).find((entry) => entry && entry.parent_field_id && fields_by_id.has(entry.parent_field_id));
    if (group) return group.parent_field_id;
  }
  return null;
}

export function build_cascading_chains(fields) {
  const condition_fields = flatten_condition_fields(fields || []);
  const fields_by_id = new Map(condition_fields.map((field) => [field.id, field]));
  const child_of = new Map();
  condition_fields.forEach((field) => {
    const parent_id = parent_link_of(field, fields_by_id);
    if (parent_id && !child_of.has(parent_id)) child_of.set(parent_id, field);
  });
  const chains = [];
  condition_fields.forEach((field) => {
    const has_parent = !!parent_link_of(field, fields_by_id);
    if (has_parent || !child_of.has(field.id)) return;
    const levels = [field];
    let current = field;
    while (child_of.has(current.id)) {
      current = child_of.get(current.id);
      levels.push(current);
    }
    chains.push({ id: field.id, levels });
  });
  return chains;
}
