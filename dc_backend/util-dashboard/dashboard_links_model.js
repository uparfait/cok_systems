const crypto = require("crypto");
const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");

const COLLECTION_NAME = "dcs_dashboard_links";

/**
 * Public share links of a form's dashboard. Each document is one link: an
 * unguessable token in the URL, a title and description for whoever
 * manages the links, an optional expiry, and who created it. Opening the
 * public page with a live token shows the form's dashboard read-only, no
 * sign-in required; an expired or deleted link shows nothing.
 */

function generate_token() {
  return crypto.randomBytes(24).toString("hex");
}

async function create_link(link) {
  const now = new Date();
  const document = Object.assign({}, link, { token: generate_token(), views: 0, created_at: now, updated_at: now });
  const result = await get_db().collection(COLLECTION_NAME).insertOne(document);
  return Object.assign({ _id: result.insertedId }, document);
}

/** The links of one form, narrowed to one dashboard when a dashboard id is given. */
async function list_links_by_form(form_group_id, dashboard_id) {
  const query = { form_group_id: form_group_id.toString() };
  if (dashboard_id) query.dashboard_id = dashboard_id.toString();
  return get_db().collection(COLLECTION_NAME).find(query).sort({ created_at: -1 }).toArray();
}

async function delete_links_by_dashboard(dashboard_id) {
  const result = await get_db().collection(COLLECTION_NAME).deleteMany({ dashboard_id: dashboard_id.toString() });
  return result.deletedCount;
}

async function get_link_by_id(link_id) {
  const object_id = to_object_id(link_id);
  if (!object_id) return null;
  return get_db().collection(COLLECTION_NAME).findOne({ _id: object_id });
}

async function get_link_by_token(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{48}$/.test(token)) return null;
  return get_db().collection(COLLECTION_NAME).findOne({ token });
}

async function update_link(link_id, changes) {
  const object_id = to_object_id(link_id);
  if (!object_id) return null;
  await get_db()
    .collection(COLLECTION_NAME)
    .updateOne({ _id: object_id }, { $set: Object.assign({}, changes, { updated_at: new Date() }) });
  return get_db().collection(COLLECTION_NAME).findOne({ _id: object_id });
}

async function delete_link(link_id) {
  const object_id = to_object_id(link_id);
  if (!object_id) return 0;
  const result = await get_db().collection(COLLECTION_NAME).deleteOne({ _id: object_id });
  return result.deletedCount;
}

async function count_view(link_id) {
  await get_db().collection(COLLECTION_NAME).updateOne({ _id: link_id }, { $inc: { views: 1 }, $set: { last_viewed_at: new Date() } });
}

/** True when the link has an expiry that is already in the past. */
function is_expired(link) {
  return !!(link && link.expires_at && new Date(link.expires_at).getTime() <= Date.now());
}

module.exports = {
  create_link,
  list_links_by_form,
  delete_links_by_dashboard,
  get_link_by_id,
  get_link_by_token,
  update_link,
  delete_link,
  count_view,
  is_expired,
};
