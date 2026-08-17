/**
 * Recursively replaces the field matching field_id (searching into group
 * children too) with the result of updater(existing_field), returning a
 * brand new fields array so React sees the change.
 */
export function update_field_by_id(fields, field_id, updater) {
  return fields.map((field) => {
    if (field.id === field_id) return updater(field);
    if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
      return Object.assign({}, field, { children: update_field_by_id(field.children, field_id, updater) });
    }
    return field;
  });
}

/**
 * Recursively removes the field matching field_id.
 */
export function delete_field_by_id(fields, field_id) {
  return fields
    .filter((field) => field.id !== field_id)
    .map((field) => {
      if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
        return Object.assign({}, field, { children: delete_field_by_id(field.children, field_id) });
      }
      return field;
    });
}

/**
 * Inserts a new field right after the field at insert_after_index (or at
 * the start when insert_after_index is -1), at the top level only.
 */
export function insert_field_at(fields, insert_after_index, new_field) {
  const next_fields = fields.slice();
  next_fields.splice(insert_after_index + 1, 0, new_field);
  return next_fields;
}

/**
 * Moves a field from one index to another at the top level, used by the
 * drag-and-drop reordering handler.
 */
export function reorder_fields(fields, from_index, to_index) {
  const next_fields = fields.slice();
  const [moved_field] = next_fields.splice(from_index, 1);
  next_fields.splice(to_index, 0, moved_field);
  return next_fields;
}

/**
 * Collects every field id in the tree (used by the JSONLogic condition
 * editors to offer a "depends on field" picker).
 */
export function collect_all_field_ids_with_labels(fields, language, accumulator) {
  const list = accumulator || [];
  fields.forEach((field) => {
    list.push({ id: field.id, type: field.type, label: field.label });
    if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
      collect_all_field_ids_with_labels(field.children, language, list);
    }
  });
  return list;
}
