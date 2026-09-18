const crypto = require("crypto");
const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");

const COLLECTION_NAME = "dcs_form_translation_links";

/**
 * Translation links of a form. Each document is one link: an unguessable
 * token in the URL, a name for whoever manages the links, the kinds of
 * text the holder may NOT change (locked_kinds), and who created it.
 * Opening the public page with a live token shows every text of the form's
 * active version in all three languages, editable, and saves the edits
 * straight back into that version - nothing else about the form can be
 * touched through it.
 */

function generate_token() {
  return crypto.randomBytes(24).toString("hex");
}

async function create_link(link) {
  const now = new Date();
  const document = Object.assign({}, link, { token: generate_token(), views: 0, saves: 0, created_at: now, updated_at: now });
  const result = await get_db().collection(COLLECTION_NAME).insertOne(document);
  return Object.assign({ _id: result.insertedId }, document);
}

async function list_links_by_form(form_group_id) {
  return get_db().collection(COLLECTION_NAME).find({ form_group_id: form_group_id.toString() }).sort({ created_at: -1 }).toArray();
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

async function delete_link(link_id) {
  const object_id = to_object_id(link_id);
  if (!object_id) return 0;
  const result = await get_db().collection(COLLECTION_NAME).deleteOne({ _id: object_id });
  return result.deletedCount;
}

async function count_view(link_id) {
  await get_db().collection(COLLECTION_NAME).updateOne({ _id: link_id }, { $inc: { views: 1 }, $set: { last_viewed_at: new Date() } });
}

async function count_save(link_id) {
  await get_db().collection(COLLECTION_NAME).updateOne({ _id: link_id }, { $inc: { saves: 1 }, $set: { last_saved_at: new Date() } });
}

module.exports = {
  create_link,
  list_links_by_form,
  get_link_by_id,
  get_link_by_token,
  delete_link,
  count_view,
  count_save,
};
