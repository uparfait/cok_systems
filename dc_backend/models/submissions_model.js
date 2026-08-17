const { get_db } = require("../db_connection/db.js");

const COLLECTION_NAME = "dcs_submissions";

/**
 * Stores a validated submission, permanently linked to the exact form
 * group and version it was collected against.
 */
async function create_submission(submission_data) {
  const document = Object.assign({}, submission_data, { submitted_at: new Date() });
  const result = await get_db().collection(COLLECTION_NAME).insertOne(document);
  return Object.assign({ _id: result.insertedId }, document);
}

/**
 * True when a submission with this client-generated idempotency key has
 * already been stored, so the offline sync retry loop never double-submits.
 */
async function find_by_client_submission_id(client_submission_id) {
  if (!client_submission_id) return null;
  return get_db().collection(COLLECTION_NAME).findOne({ client_submission_id });
}

/**
 * Paginated list of submissions for one form group (optionally filtered to
 * a single version), newest first.
 */
async function list_submissions(form_group_id, version, page, limit) {
  const filter = { form_group_id };
  if (version !== undefined && version !== null) filter.version = Number(version);

  const skip = (page - 1) * limit;
  const collection = get_db().collection(COLLECTION_NAME);

  const [items, total] = await Promise.all([
    collection.find(filter).sort({ submitted_at: -1 }).skip(skip).limit(limit).toArray(),
    collection.countDocuments(filter),
  ]);

  return { items, total };
}

/**
 * Permanently removes every submission collected against any of the given
 * form groups - only ever called as part of deleting the whole project
 * those forms belong to.
 */
async function delete_by_form_group_ids(form_group_ids) {
  if (!form_group_ids || form_group_ids.length === 0) return 0;
  const result = await get_db().collection(COLLECTION_NAME).deleteMany({ form_group_id: { $in: form_group_ids } });
  return result.deletedCount;
}

/**
 * Number of submissions collected against one specific form version - used
 * to warn an author how much data a version delete would also remove.
 */
async function count_submissions_for_version(form_group_id, version) {
  return get_db().collection(COLLECTION_NAME).countDocuments({ form_group_id, version: Number(version) });
}

/**
 * Permanently removes every submission collected against one specific form
 * version - only ever called as part of deleting that version itself, and
 * only when the author explicitly opted to also delete its data.
 */
async function delete_by_form_group_and_version(form_group_id, version) {
  const result = await get_db()
    .collection(COLLECTION_NAME)
    .deleteMany({ form_group_id, version: Number(version) });
  return result.deletedCount;
}

module.exports = {
  create_submission,
  find_by_client_submission_id,
  list_submissions,
  delete_by_form_group_ids,
  count_submissions_for_version,
  delete_by_form_group_and_version,
};
