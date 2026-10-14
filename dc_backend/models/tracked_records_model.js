const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");

const COLLECTION_NAME = "dcs_submissions";
const MAX_MATCHES = 50;
const TEST_DATA_FLAG = "is_test_data_generated_sss_ddd";
const PUBLIC_PROJECTION = { data: 1, version: 1, submitted_at: 1, updated_at: 1, history: 1, tracking_periods: 1, respondent: 1 };

/**
 * The records of a TRACKED form (see utilities/tracking.js) live in the
 * same dcs_submissions collection as every other response; this model
 * holds only what finding them again by key and updating them needs.
 */

/**
 * record_key (the whole key, joined) rides the first index: that is what
 * uniqueness and the import check. The public lookup searches one key
 * field at a time through record_key_pairs, which the second index serves
 * - both parts of a pair sit in the same array element, so an $elemMatch
 * on { f, k } binds both columns. The third serves the tables and
 * dashboards, which window a register on the moment it last moved.
 */
async function ensure_tracked_record_indexes() {
  const collection = get_db().collection(COLLECTION_NAME);
  await collection.createIndex({ form_group_id: 1, record_key: 1, submitted_at: -1 }, { name: "form_group_record_key", sparse: true });
  await collection.createIndex({ form_group_id: 1, "record_key_pairs.f": 1, "record_key_pairs.k": 1 }, { name: "form_group_record_key_pairs", sparse: true });
  await collection.createIndex({ form_group_id: 1, updated_at: -1 }, { name: "form_group_updated_at" });
}

/**
 * Every record of the form carrying this whole key, newest first, capped.
 * Only what the public page shows travels: the answers, the dates and the
 * history - never approval tokens or internal markers.
 */
async function list_by_record_key(form_group_id, record_key) {
  if (!record_key) return [];
  return get_db()
    .collection(COLLECTION_NAME)
    .find({ form_group_id, record_key }, { projection: PUBLIC_PROJECTION })
    .sort({ submitted_at: -1 })
    .limit(MAX_MATCHES)
    .toArray();
}

/**
 * The filter of a lookup by ONE key field (field_ids a string), by any of
 * a set of key fields (an array - what "no field given" means to the
 * public lookup, which still rides the pairs index), or by any pair at
 * all (null).
 */
function key_pair_filter(form_group_id, field_ids, key) {
  if (Array.isArray(field_ids)) return { form_group_id, record_key_pairs: { $elemMatch: { f: { $in: field_ids }, k: key } } };
  if (field_ids) return { form_group_id, record_key_pairs: { $elemMatch: { f: field_ids, k: key } } };
  return { form_group_id, "record_key_pairs.k": key };
}

/**
 * One page of the records whose key field holds this value, newest first:
 * { items, total }. page starts at 1; limit is capped at MAX_MATCHES.
 */
async function list_by_key_pair(form_group_id, field_ids, key, page, limit) {
  if (!key) return { items: [], total: 0 };
  const page_size = Math.min(MAX_MATCHES, Math.max(1, Number(limit) || MAX_MATCHES));
  const page_number = Math.max(1, Number(page) || 1);
  const filter = key_pair_filter(form_group_id, field_ids, key);
  const collection = get_db().collection(COLLECTION_NAME);
  const [items, total] = await Promise.all([
    collection
      .find(filter, { projection: PUBLIC_PROJECTION })
      .sort({ submitted_at: -1, _id: -1 })
      .skip((page_number - 1) * page_size)
      .limit(page_size)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  return { items, total };
}

/** How many records of the form hold this value on this key field (or on any of these). */
async function count_by_key_pair(form_group_id, field_ids, key) {
  if (!key) return 0;
  return get_db().collection(COLLECTION_NAME).countDocuments(key_pair_filter(form_group_id, field_ids, key));
}

/** Which of these whole keys the form already holds - one query for a whole import batch. */
async function list_existing_record_keys(form_group_id, record_keys) {
  const keys = (record_keys || []).filter(Boolean);
  if (keys.length === 0) return [];
  return get_db().collection(COLLECTION_NAME).distinct("record_key", { form_group_id, record_key: { $in: keys } });
}

/** How many records of the form already carry this whole key. */
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

/**
 * Re-stamps a record's whole key and its searchable pairs after a full
 * edit changed a key field's own answer - kept apart from
 * apply_record_update because a respondent update can never touch a key,
 * only a staff edit can.
 */
async function apply_record_key(submission_id, record_key, record_key_pairs) {
  const object_id = to_object_id(submission_id);
  if (!object_id) return false;
  const set = { record_key, record_key_pairs: Array.isArray(record_key_pairs) ? record_key_pairs : [] };
  const result = await get_db().collection(COLLECTION_NAME).updateOne({ _id: object_id }, { $set: set });
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
  MAX_MATCHES,
  ensure_tracked_record_indexes,
  list_by_record_key,
  list_by_key_pair,
  count_by_key_pair,
  count_by_record_key,
  find_record,
  apply_record_update,
  apply_record_key,
  list_existing_record_keys,
  to_public_record,
};
