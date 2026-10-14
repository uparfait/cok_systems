const { flatten_fields } = require("../../jsonlogic/dependency_graph.js");

/**
 * Respondents find a record of the ACTUAL form by searching one of its
 * fields. Only a typed answer can be searched - a text, a number or a
 * long text - and only when the follow-up form still carries a field of
 * that same id, since that is where the found record's answer is loaded.
 */
const SEARCHABLE_TYPES = ["text", "number", "large_text"];

/** The searchable fields of the source schema that the follow-up schema also has: [{ id, type }]. */
function searchable_fields(source_schema, follow_up_schema) {
  const follow_up_ids = new Set(flatten_fields((follow_up_schema && follow_up_schema.fields) || []).map((field) => field && field.id).filter(Boolean));
  return flatten_fields((source_schema && source_schema.fields) || [])
    .filter((field) => field && field.id && SEARCHABLE_TYPES.includes(field.type) && follow_up_ids.has(field.id))
    .map((field) => ({ id: field.id, type: field.type }));
}

function searchable_field_ids(source_schema, follow_up_schema) {
  return searchable_fields(source_schema, follow_up_schema).map((field) => field.id);
}

module.exports = { SEARCHABLE_TYPES, searchable_fields, searchable_field_ids };
