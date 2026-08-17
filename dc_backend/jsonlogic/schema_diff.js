const { flatten_fields } = require("./dependency_graph.js");
const { DATA_FIELD_TYPES } = require("../constants/field_types.js");

/**
 * The id of every data-collection field (one that actually stores a
 * response) anywhere in a schema, including inside groups/sections.
 */
function collect_data_field_ids(schema) {
  const flat = flatten_fields((schema && schema.fields) || []);
  return new Set(flat.filter((field) => DATA_FIELD_TYPES.includes(field.type)).map((field) => field.id));
}

/**
 * True only when a data-collection field was added or removed between two
 * schema versions - the sole trigger for publishing a brand new,
 * immutable form version. Editing an existing field's condition, design,
 * label or help text, or adding/removing/editing a content (form design)
 * component, never changes this set, so those edits update the current
 * version in place instead of minting a new one.
 */
function has_data_field_set_changed(old_schema, new_schema) {
  const old_ids = collect_data_field_ids(old_schema);
  const new_ids = collect_data_field_ids(new_schema);

  if (old_ids.size !== new_ids.size) return true;
  for (const id of old_ids) {
    if (!new_ids.has(id)) return true;
  }
  return false;
}

module.exports = { has_data_field_set_changed };
