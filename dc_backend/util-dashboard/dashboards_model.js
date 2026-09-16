const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");

const COLLECTION_NAME = "dcs_dashboards";
const FIRST_NAME = "Dashboard 1";

/**
 * A form holds ANY number of dashboards, each its own document: a name the
 * author gave it, its widget list and timestamps. The aggregated data is
 * never stored - it is always computed live from dcs_submissions when a
 * dashboard is viewed. project_id rides along so deleting a whole project
 * sweeps its forms' dashboards in one query.
 *
 * Before dashboards had names a form owned exactly one nameless document;
 * such a document is treated as the form's first dashboard and named
 * "Dashboard 1" the first time it is listed, so nothing already built is
 * lost or renamed behind anyone's back.
 */

const collection = () => get_db().collection(COLLECTION_NAME);

async function list_dashboards_by_form(form_group_id) {
  const form_id = form_group_id.toString();
  const nameless = await collection().find({ form_group_id: form_id, name: { $in: [null, ""] } }).toArray();
  if (nameless.length > 0) {
    await Promise.all(nameless.map((document, index) => collection().updateOne({ _id: document._id }, { $set: { name: index === 0 ? FIRST_NAME : `Dashboard ${index + 1}` } })));
  }
  return collection().find({ form_group_id: form_id }).sort({ created_at: 1, _id: 1 }).toArray();
}

async function get_dashboard_by_id(form_group_id, dashboard_id) {
  const object_id = to_object_id(dashboard_id);
  if (!object_id) return null;
  return collection().findOne({ _id: object_id, form_group_id: form_group_id.toString() });
}

/** The form's first dashboard - what an unscoped (older) request means. */
async function get_dashboard_by_form(form_group_id) {
  const dashboards = await list_dashboards_by_form(form_group_id);
  return dashboards[0] || null;
}

async function is_name_taken(form_group_id, name, exclude_dashboard_id) {
  const query = { form_group_id: form_group_id.toString(), name_normalized: name.trim().toLowerCase() };
  const exclude = exclude_dashboard_id ? to_object_id(exclude_dashboard_id) : null;
  if (exclude) query._id = { $ne: exclude };
  return !!(await collection().findOne(query));
}

async function create_dashboard(form_group_id, project_id, name) {
  const now = new Date();
  const document = {
    form_group_id: form_group_id.toString(),
    project_id: project_id.toString(),
    name: name.trim(),
    name_normalized: name.trim().toLowerCase(),
    widgets: [],
    created_at: now,
    updated_at: now,
  };
  const result = await collection().insertOne(document);
  return Object.assign({ _id: result.insertedId }, document);
}

async function rename_dashboard(form_group_id, dashboard_id, name) {
  const object_id = to_object_id(dashboard_id);
  if (!object_id) return null;
  await collection().updateOne({ _id: object_id, form_group_id: form_group_id.toString() }, { $set: { name: name.trim(), name_normalized: name.trim().toLowerCase(), updated_at: new Date() } });
  return get_dashboard_by_id(form_group_id, dashboard_id);
}

async function delete_dashboard(form_group_id, dashboard_id) {
  const object_id = to_object_id(dashboard_id);
  if (!object_id) return 0;
  const result = await collection().deleteOne({ _id: object_id, form_group_id: form_group_id.toString() });
  return result.deletedCount;
}

/** Replaces one dashboard's widgets and returns the saved copy. */
async function save_widgets(form_group_id, dashboard_id, widgets) {
  const object_id = to_object_id(dashboard_id);
  if (!object_id) return null;
  await collection().updateOne({ _id: object_id, form_group_id: form_group_id.toString() }, { $set: { widgets, updated_at: new Date() } });
  return get_dashboard_by_id(form_group_id, dashboard_id);
}

/**
 * Unscoped save (the older single-dashboard route): writes the form's first
 * dashboard, creating "Dashboard 1" when the form has none yet.
 */
async function save_dashboard(form_group_id, project_id, widgets) {
  const first = (await get_dashboard_by_form(form_group_id)) || (await create_dashboard(form_group_id, project_id, FIRST_NAME));
  return save_widgets(form_group_id, first._id, widgets);
}

/**
 * Removes every form dashboard of a project - only ever called while
 * deleting the whole project.
 */
async function delete_dashboards_by_project(project_id) {
  const result = await collection().deleteMany({ project_id: project_id.toString() });
  return result.deletedCount;
}

/** The dashboard as every route returns it. */
function strip_dashboard(dashboard) {
  if (!dashboard) return null;
  return {
    id: dashboard._id.toString(),
    name: dashboard.name || FIRST_NAME,
    widgets_count: Array.isArray(dashboard.widgets) ? dashboard.widgets.length : 0,
    created_at: dashboard.created_at,
    updated_at: dashboard.updated_at,
  };
}

module.exports = {
  list_dashboards_by_form,
  get_dashboard_by_id,
  get_dashboard_by_form,
  is_name_taken,
  create_dashboard,
  rename_dashboard,
  delete_dashboard,
  save_widgets,
  save_dashboard,
  delete_dashboards_by_project,
  strip_dashboard,
  FIRST_NAME,
};
