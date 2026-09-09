const { get_db } = require("../db_connection/db.js");

const COLLECTION_NAME = "dcs_dashboards";

/**
 * One dashboard document per project: the widget list plus timestamps. The
 * aggregated data itself is never stored - it is always computed live from
 * dcs_submissions when the dashboard is viewed.
 */

async function get_dashboard_by_project(project_id) {
  return get_db().collection(COLLECTION_NAME).findOne({ project_id: project_id.toString() });
}

/**
 * Creates or replaces the project's dashboard configuration and returns the
 * saved copy.
 */
async function save_dashboard(project_id, widgets) {
  const now = new Date();
  await get_db()
    .collection(COLLECTION_NAME)
    .updateOne(
      { project_id: project_id.toString() },
      { $set: { project_id: project_id.toString(), widgets, updated_at: now }, $setOnInsert: { created_at: now } },
      { upsert: true },
    );
  return get_dashboard_by_project(project_id);
}

/**
 * Removes a project's dashboard - only ever called while deleting the whole
 * project.
 */
async function delete_dashboard_by_project(project_id) {
  const result = await get_db().collection(COLLECTION_NAME).deleteOne({ project_id: project_id.toString() });
  return result.deletedCount > 0;
}

module.exports = {
  get_dashboard_by_project,
  save_dashboard,
  delete_dashboard_by_project,
};
