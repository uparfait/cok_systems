const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");
const { list_records_in } = require("./submissions_model.js");
const media_model = require("./submission_media_model.js");

const COLLECTION_NAME = "dcs_follow_up_submissions";

/**
 * The records a follow-up form collects. Each one is a NEW record: the
 * record of the actual form it was loaded from (source_submission_id)
 * is never touched. The shape mirrors dcs_submissions (data, submitted_at,
 * respondent, client_submission_id, media answers stored as
 * {name, type, size, url}) so the data table, the gallery and the
 * dashboards read both collections the same way.
 */

const collection = () => get_db().collection(COLLECTION_NAME);

/**
 * The index the listing, the gallery and every dashboard pipeline open
 * with: one follow-up's records, newest first. Called once at startup.
 */
async function ensure_follow_up_submission_indexes() {
  await collection().createIndex({ follow_up_group_id: 1, submitted_at: -1 }, { name: "follow_up_group_submitted_at" });
  await collection().createIndex({ client_submission_id: 1 }, { name: "follow_up_client_submission_id", sparse: true });
}

async function create(record) {
  const document = Object.assign({}, record, { submitted_at: record.submitted_at instanceof Date ? record.submitted_at : new Date() });
  const result = await collection().insertOne(document);
  return Object.assign({ _id: result.insertedId }, document);
}

/** The record already stored for an offline client's idempotency key, or null. */
async function find_by_client_submission_id(client_submission_id) {
  if (!client_submission_id) return null;
  return collection().findOne({ client_submission_id });
}

/**
 * One page of a follow-up's records: the same search, column filters,
 * record pin, sort and paging as the actual form's table.
 */
async function list(follow_up_group_id, version, page, limit, date_bounds, options) {
  return list_records_in(COLLECTION_NAME, { follow_up_group_id }, version, page, limit, date_bounds, Object.assign({}, options, { tracking: null }));
}

async function find_by_id(submission_id) {
  const object_id = to_object_id(submission_id);
  if (!object_id) return null;
  return collection().findOne({ _id: object_id });
}

/** The records a set of ids resolves to, with what a permission check needs. */
async function find_by_ids(submission_ids) {
  const object_ids = (submission_ids || []).map((id) => to_object_id(id)).filter(Boolean);
  if (object_ids.length === 0) return [];
  return collection().find({ _id: { $in: object_ids } }, { projection: { follow_up_group_id: 1, source_form_group_id: 1, project_id: 1 } }).toArray();
}

/** Replaces a record's answers (and who edited them) and stamps updated_at. */
async function update_data(submission_id, data, respondent) {
  const object_id = to_object_id(submission_id);
  if (!object_id) return null;
  const changes = { data, updated_at: new Date() };
  if (respondent !== undefined) changes.respondent = respondent;
  await collection().updateOne({ _id: object_id }, { $set: changes });
  return collection().findOne({ _id: object_id });
}

async function delete_by_ids(submission_ids) {
  const object_ids = (submission_ids || []).map((id) => to_object_id(id)).filter(Boolean);
  if (object_ids.length === 0) return 0;
  const result = await collection().deleteMany({ _id: { $in: object_ids } });
  return result.deletedCount;
}

async function delete_by_version(follow_up_group_id, version) {
  const result = await collection().deleteMany({ follow_up_group_id, version: Number(version) });
  return result.deletedCount;
}

async function count_by_group(follow_up_group_id) {
  return collection().countDocuments({ follow_up_group_id });
}

/** Removes every follow-up record of a project - only while deleting the project itself. */
async function delete_by_project(project_id) {
  const result = await collection().deleteMany({ project_id: project_id.toString() });
  return result.deletedCount;
}

/** The follow-up's side of a gallery, as submission_media_model.list_media reads it. */
function media_side(follow_up_group_id, field_ids, date_bounds, filters) {
  return { collection: COLLECTION_NAME, match: { follow_up_group_id }, field_ids, date_bounds, filters, tracking: null, source: "follow_up", follow_up_group_id };
}

/** One page of the follow-up's own pictures and videos. */
async function list_media(follow_up_group_id, field_ids, skip, limit, date_bounds, filters) {
  return media_model.list_media([media_side(follow_up_group_id, field_ids, date_bounds, filters)], skip, limit);
}

module.exports = {
  COLLECTION_NAME,
  ensure_follow_up_submission_indexes,
  create,
  find_by_client_submission_id,
  list,
  find_by_id,
  find_by_ids,
  update_data,
  delete_by_ids,
  delete_by_version,
  count_by_group,
  delete_by_project,
  media_side,
  list_media,
};
