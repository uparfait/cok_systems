const { get_db } = require("../db_connection/db.js");

const COLLECTION_NAME = "dcs_project_access";


async function get_access_by_project(project_id) {
  return get_db().collection(COLLECTION_NAME).findOne({ project_id: project_id.toString() });
}

/**
 * Returns the access documents of many projects at once, used when the
 * projects list is filtered for the requesting user in a single query.
 */
async function get_access_for_projects(project_ids) {
  if (!project_ids || project_ids.length === 0) return [];
  return get_db()
    .collection(COLLECTION_NAME)
    .find({ project_id: { $in: project_ids.map((id) => id.toString()) } })
    .toArray();
}

/**
 * Creates or replaces a project's access rules and returns the saved copy.
 */
async function save_access(project_id, access_data) {
  const now = new Date();
  const document = Object.assign({}, access_data, { project_id: project_id.toString(), updated_at: now });
  await get_db()
    .collection(COLLECTION_NAME)
    .updateOne(
      { project_id: project_id.toString() },
      { $set: document, $setOnInsert: { created_at: now } },
      { upsert: true },
    );
  return get_access_by_project(project_id);
}

/**
 * Removes a project's access rules - only ever called as part of deleting
 * the project itself.
 */
async function delete_access_by_project(project_id) {
  const result = await get_db().collection(COLLECTION_NAME).deleteOne({ project_id: project_id.toString() });
  return result.deletedCount > 0;
}

module.exports = {
  get_access_by_project,
  get_access_for_projects,
  save_access,
  delete_access_by_project,
};
