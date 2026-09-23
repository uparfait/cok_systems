const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");

const COLLECTION_NAME = "dcs_submissions";
const MAX_MATCHES = 50;
const TEST_DATA_FLAG = "is_test_data_generated_sss_ddd";

/**
 * The records of a TRACKED form (see utilities/tracking.js) live in the
 * same dcs_submissions collection as every other response; this model
 * holds only what finding them again by key and updating them needs.
 */

/** A key lookup rides this index; the sort keeps the newest record first. */
async function ensure_tracked_record_indexes() {
  await get_db().collection(COLLECTION_NAME).createIndex({ form_group_id: 1, record_key: 1, submitted_at: -1 }, { name: "form_group_record_key", sparse: true });
}

/**
 * Every record of the form carrying this key, newest first, capped. Only
 * what the public page shows travels: the answers, the dates and the
 * history - never approval tokens or internal markers.
 */
async function list_by_record_key(form_group_id, record_key) {
  if (!record_key) return [];
  return get_db()
    .collection(COLLECTION_NAME)
    .find(
      { form_group_id, record_key },
      { projection: { data: 1, version: 1, submitted_at: 1, updated_at: 1, history: 1, tracking_periods: 1, respondent: 1 } },
    )
    .sort({ submitted_at: -1 })
    .limit(MAX_MATCHES)
    .toArray();
}

/** How many records of the form already carry this key. */
async function count_by_record_key(form_group_id, record_key) {
  if (!record_key) return 0;
  return get_db().collection(COLLECTION_NAME).countDocuments({ form_group_id, record_key });
}

/** One record of the form by id, or null - the full document, for the update path. */
async function find_record(form_group_id, submission_id) {
  const object_id = to_object_id(submission_id);
  if (!object_id) return null;
  return get_db().collection(COLLECTION_NAME).findOne({ _id: object_id, form_group_id });
}

/**
 * Writes one update: the new answers, the value periods, the appended
 * history entry, the update time and - when the form routes updates
 * through approval - the fresh approval state. approval_request_id is
 * cleared so a running batch schedule picks the changed record up again.
 */
async function apply_record_update(submission_id, patch) {
  const object_id = to_object_id(submission_id);
  if (!object_id) return false;
  const set = {
    data: patch.data,
    tracking_periods: patch.tracking_periods,
    updated_at: patch.updated_at,
    version: patch.version,
  };
  if (patch.approval !== undefined) set.approval = patch.approval;
  const update = { $set: set, $push: { history: patch.history_entry } };
  if (patch.clear_request) update.$unset = { approval_request_id: "" };
  const result = await get_db().collection(COLLECTION_NAME).updateOne({ _id: object_id }, update);
  return result.matchedCount > 0;
}

/** The record as the public page may see it: no approval tokens, no internal flags. */
function to_public_record(record) {
  const history = Array.isArray(record.history) ? record.history : [];
  return {
    _id: record._id,
    version: record.version,
    submitted_at: record.submitted_at,
    updated_at: record.updated_at || null,
    data: record.data || {},
    history: history.map((entry) => ({
      at: entry.at,
      kind: entry.kind,
      by: entry.by && entry.by.name ? { name: entry.by.name } : null,
      changes: Array.isArray(entry.changes) ? entry.changes : [],
    })),
    tracking_periods: record.tracking_periods || {},
  };
}

module.exports = {
  TEST_DATA_FLAG,
  ensure_tracked_record_indexes,
  list_by_record_key,
  count_by_record_key,
  find_record,
  apply_record_update,
  to_public_record,
};
