const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");

const COLLECTION_NAME = "dcs_projects";

/**
 * Inserts a new project document.
 */
async function create_project(project_data) {
  const now = new Date();
  const document = Object.assign({}, project_data, { created_at: now, updated_at: now });
  const result = await get_db().collection(COLLECTION_NAME).insertOne(document);
  return Object.assign({ _id: result.insertedId }, document);
}

/**
 * Lists every project, most recently updated first. Projects are a shared
 * workspace across all authenticated users (no per-user ownership scoping),
 * matching how the sidebar is expected to show "all projects".
 */
async function list_projects() {
  return get_db().collection(COLLECTION_NAME).find({}).sort({ updated_at: -1 }).toArray();
}

/**
 * Finds a single project by its identifier.
 */
async function find_project_by_id(project_id) {
  const object_id = to_object_id(project_id);
  if (!object_id) return null;
  return get_db().collection(COLLECTION_NAME).findOne({ _id: object_id });
}

/**
 * Applies a partial update to a project and returns the refreshed document.
 */
async function update_project(project_id, updates) {
  const object_id = to_object_id(project_id);
  if (!object_id) return null;
  const patch = Object.assign({}, updates, { updated_at: new Date() });
  await get_db().collection(COLLECTION_NAME).updateOne({ _id: object_id }, { $set: patch });
  return find_project_by_id(project_id);
}

/**
 * Permanently removes a project document. Its forms and collected data are
 * removed separately by the caller before this runs.
 */
async function delete_project(project_id) {
  const object_id = to_object_id(project_id);
  if (!object_id) return false;
  const result = await get_db().collection(COLLECTION_NAME).deleteOne({ _id: object_id });
  return result.deletedCount > 0;
}

module.exports = {
  create_project,
  list_projects,
  find_project_by_id,
  update_project,
  delete_project,
};
