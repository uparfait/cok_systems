const { get_db } = require("../db_connection/db.js");

const COLLECTION_NAME = "dcs_dashboards";

/**
 * One dashboard document per FORM (a project holds one form dashboard per
 * form group): the widget list plus timestamps. The aggregated data itself
 * is never stored - it is always computed live from dcs_submissions when
 * the dashboard is viewed. project_id rides along only so deleting a whole
 * project can sweep its forms' dashboards in one query.
 */

async function get_dashboard_by_form(form_group_id) {
  return get_db().collection(COLLECTION_NAME).findOne({ form_group_id: form_group_id.toString() });
}

/**
 * Creates or replaces the form's dashboard configuration and returns the
 * saved copy.
 */
async function save_dashboard(form_group_id, project_id, widgets) {
  const now = new Date();
  await get_db()
    .collection(COLLECTION_NAME)
    .updateOne(
      { form_group_id: form_group_id.toString() },
      {
        $set: { form_group_id: form_group_id.toString(), project_id: project_id.toString(), widgets, updated_at: now },
        $setOnInsert: { created_at: now },
      },
      { upsert: true },
    );
  return get_dashboard_by_form(form_group_id);
}

/**
 * Removes every form dashboard of a project - only ever called while
 * deleting the whole project.
 */
async function delete_dashboards_by_project(project_id) {
  const result = await get_db().collection(COLLECTION_NAME).deleteMany({ project_id: project_id.toString() });
  return result.deletedCount;
}

module.exports = {
  get_dashboard_by_form,
  save_dashboard,
  delete_dashboards_by_project,
};
