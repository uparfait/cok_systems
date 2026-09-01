const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");

const COLLECTION_NAME = "dcs_templates";

/**
 * Creates a new, reusable field template - a saved fields array with a name
 * and description, importable into any form (or any other template)
 * regardless of project. Templates are never versioned: editing one only
 * ever changes that same document, since inserting a template into a form
 * always copies its fields at that moment rather than linking to it live.
 */
async function create_template(template_data) {
  const now = new Date();
  const document = Object.assign({}, template_data, { created_at: now, updated_at: now });
  const result = await get_db().collection(COLLECTION_NAME).insertOne(document);
  return Object.assign({ _id: result.insertedId }, document);
}

/**
 * Lists every template, newest first - name and description only, never
 * the fields array, since the list view is just a picker and the full
 * document is fetched separately once one is actually opened or inserted.
 */
async function list_templates() {
  return get_db()
    .collection(COLLECTION_NAME)
    .find({}, { projection: { name: 1, description: 1, created_at: 1, updated_at: 1, is_system_template: 1 } })
    .sort({ updated_at: -1 })
    .toArray();
}

/**
 * Returns one template's full document, including its fields - used both
 * when opening it for editing and when resolving a __is__template__
 * placeholder that references it.
 */
async function get_template_by_id(template_id) {
  const object_id = to_object_id(template_id);
  if (!object_id) return null;
  return get_db().collection(COLLECTION_NAME).findOne({ _id: object_id });
}

/**
 * True when another template already uses this name.
 */
async function is_template_name_taken(name, exclude_template_id) {
  const query = { name_normalized: name.trim().toLowerCase() };
  const exclude_object_id = exclude_template_id ? to_object_id(exclude_template_id) : null;
  if (exclude_object_id) {
    query._id = { $ne: exclude_object_id };
  }
  const existing = await get_db().collection(COLLECTION_NAME).findOne(query);
  return !!existing;
}

/**
 * Updates a template's name, description and/or fields in place.
 */
async function update_template(template_id, template_data) {
  const object_id = to_object_id(template_id);
  if (!object_id) return null;
  await get_db()
    .collection(COLLECTION_NAME)
    .updateOne({ _id: object_id }, { $set: Object.assign({}, template_data, { updated_at: new Date() }) });
  return get_template_by_id(template_id);
}

/**
 * Permanently deletes a template. Never affects any form that already
 * inserted it, since that form's copy of the fields is fully its own.
 * System templates (is_system_template: true) cannot be deleted.
 */
async function delete_template(template_id) {
  const object_id = to_object_id(template_id);
  if (!object_id) return false;

  const template = await get_db().collection(COLLECTION_NAME).findOne({ _id: object_id });
  if (!template) return false;

  if (template.is_system_template) {
    return null;
  }

  const result = await get_db().collection(COLLECTION_NAME).deleteOne({ _id: object_id });
  return result.deletedCount > 0;
}

module.exports = {
  create_template,
  list_templates,
  get_template_by_id,
  is_template_name_taken,
  update_template,
  delete_template,
};
