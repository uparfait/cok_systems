const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");
const { key_ids_of, key_fields_of, key_fields_version } = require("../utilities/tracking.js");

const COLLECTION_NAME = "dcs_submissions";
const FORMS_COLLECTION = "dcs_forms";
const STAMP_BATCH = 500;
const MAX_MATCHES = 50;
const TEST_DATA_FLAG = "is_test_data_generated_sss_ddd";
// record_key_pairs rides along so a lookup can tell a legacy row (no pairs
// yet) from a stamped one; to_public_record never sends it.
const PUBLIC_PROJECTION = { data: 1, version: 1, submitted_at: 1, updated_at: 1, history: 1, tracking_periods: 1, respondent: 1, record_key_pairs: 1 };

/**
 * The records of a TRACKED form (see utilities/tracking.js) live in the
 * same dcs_submissions collection as every other response; this model
 * holds only what finding them again by key and updating them needs.
 */

/**
 * record_key (the whole key, joined) rides the first index: that is what
 * uniqueness and the import check. The public lookup searches the key
 * fields through record_key_pairs, which the second index serves - both
 * parts of a pair sit in the same array element, so an $elemMatch on
 * { f, k } binds both columns. The third serves the tables and dashboards,
 * which window a register on the moment it last moved. The fourth lets a
 * backfill find the records whose pairs were built for other key fields
 * (or never built) without reading the rest of the form.
 */
async function ensure_tracked_record_indexes() {
  const collection = get_db().collection(COLLECTION_NAME);
  await collection.createIndex({ form_group_id: 1, record_key: 1, submitted_at: -1 }, { name: "form_group_record_key", sparse: true });
  await collection.createIndex({ form_group_id: 1, "record_key_pairs.f": 1, "record_key_pairs.k": 1 }, { name: "form_group_record_key_pairs", sparse: true });
  await collection.createIndex({ form_group_id: 1, updated_at: -1 }, { name: "form_group_updated_at" });
  await collection.createIndex({ form_group_id: 1, record_key_fields: 1 }, { name: "form_group_record_key_fields" });
}

/**
 * Stamps record_key, record_key_pairs and record_key_fields from the
 * records' own ANSWERS, for the form's current key fields, on every
 * record the filter selects: read through a cursor, written back in
 * batches with bulkWrite (the key normalisation - trimming, lowercasing,
 * canonical numbers - lives in JS). Idempotent: a record already carrying
 * exactly these values is not modified. Returns how many changed.
 */
async function stamp_keys_from_data(tracking, filter) {
  if (key_ids_of(tracking).length === 0) return 0;
  const collection = get_db().collection(COLLECTION_NAME);
  const cursor = collection.find(filter, { projection: { data: 1 } }).batchSize(STAMP_BATCH);
  let stamped = 0;
  let operations = [];
  const flush = async () => {
    if (operations.length === 0) return;
    const result = await collection.bulkWrite(operations, { ordered: false });
    stamped += result.modifiedCount;
    operations = [];
  };
  for await (const record of cursor) {
    operations.push({ updateOne: { filter: { _id: record._id }, update: { $set: key_fields_of(tracking, record.data || {}) } } });
    if (operations.length >= STAMP_BATCH) await flush();
  }
  await flush();
  return stamped;
}

/**
 * Brings ONE form's records up to its current key fields: every record
 * whose marker (record_key_fields) is not the current one - collected
 * before tracking was switched on, before the pairs existed, or under
 * other key fields - gets its key, pairs and marker rebuilt from its
 * answers. Cheap on a repeat run: the marker is indexed, so a form whose
 * records are all current reads nothing. Run at startup for every
 * tracked form, by a lookup that finds nothing, and after an author
 * changes the key fields.
 */
async function backfill_form_key_pairs(form_group_id, tracking) {
  if (!form_group_id) return 0;
  return stamp_keys_from_data(tracking, { form_group_id, record_key_fields: { $ne: key_fields_version(tracking) } });
}

/** Re-stamps these records from their answers (a lookup that had to read the answers themselves). */
async function stamp_records_from_data(tracking, submission_ids) {
  const ids = (submission_ids || []).map((id) => to_object_id(id)).filter(Boolean);
  if (ids.length === 0) return 0;
  return stamp_keys_from_data(tracking, { _id: { $in: ids } });
}

/** The startup pass: every active tracked form, one update each. */
async function backfill_record_key_pairs() {
  const forms = await get_db()
    .collection(FORMS_COLLECTION)
    .find({ is_active: true, "tracking.enabled": true }, { projection: { form_group_id: 1, tracking: 1 } })
    .toArray();
  let stamped = 0;
  for (const form of forms) stamped += await backfill_form_key_pairs(form.form_group_id, form.tracking);
  return stamped;
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

function escape_regex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The typed value as a case-insensitive CONTAINS pattern: the lookup is a search, not an equality. */
function contains_pattern(key) {
  return new RegExp(escape_regex(key), "i");
}

/**
 * The filter of a lookup: the records whose key value CONTAINS the typed
 * value on ANY of the given key fields (field_ids an array - the normal
 * call), on one key field (a string - the optional narrowing), or on any
 * pair at all (null). A record never has to match on every key field.
 *
 * with_record_key adds the records whose WHOLE key contains the value:
 * the legacy rows that carry record_key alone, written before the pairs
 * existed. Both branches ride their own index.
 */
function key_pair_filter(form_group_id, field_ids, key, with_record_key) {
  const pattern = contains_pattern(key);
  let pairs;
  if (Array.isArray(field_ids)) pairs = { record_key_pairs: { $elemMatch: { f: { $in: field_ids }, k: pattern } } };
  else if (field_ids) pairs = { record_key_pairs: { $elemMatch: { f: field_ids, k: pattern } } };
  else pairs = { "record_key_pairs.k": pattern };
  if (!with_record_key) return Object.assign({ form_group_id }, pairs);
  return { form_group_id, $or: [pairs, { record_key: pattern }] };
}

/**
 * The normalised key values of a record on the searched fields, as an
 * array expression: its pairs' k (those of the given fields), plus its
 * whole key when the legacy fallback is on.
 */
function pair_candidates(field_ids, with_record_key) {
  const ids = Array.isArray(field_ids) ? field_ids : field_ids ? [field_ids] : null;
  const pairs = {
    $filter: {
      input: { $ifNull: ["$record_key_pairs", []] },
      as: "pair",
      cond: ids ? { $in: ["$$pair.f", ids] } : { $literal: true },
    },
  };
  const values = { $map: { input: pairs, as: "pair", in: { $ifNull: ["$$pair.k", ""] } } };
  return with_record_key ? { $concatArrays: [values, [{ $ifNull: ["$record_key", ""] }]] } : values;
}

/**
 * One page of a search, closest first: the records holding the value
 * EXACTLY on a searched field, then those whose value STARTS with it,
 * then the rest that merely contain it - newest first within each group.
 * candidates is the array expression of a record's normalised values on
 * the searched fields (lowercased, like the typed key). page starts at
 * 1; limit is capped at MAX_MATCHES. Returns { items, total }; each item
 * still carries record_key_pairs (absent on a legacy row) so the caller
 * can stamp what it meets.
 */
async function ranked_page(filter, candidates, key, page, limit) {
  const page_size = Math.min(MAX_MATCHES, Math.max(1, Number(limit) || MAX_MATCHES));
  const page_number = Math.max(1, Number(page) || 1);
  const starts_with = { $anyElementTrue: { $map: { input: candidates, as: "value", in: { $eq: [{ $indexOfCP: ["$$value", key] }, 0] } } } };
  const rank = { $switch: { branches: [{ case: { $in: [key, candidates] }, then: 0 }, { case: starts_with, then: 1 }], default: 2 } };
  const [result] = await get_db()
    .collection(COLLECTION_NAME)
    .aggregate(
      [
        { $match: filter },
        { $addFields: { __rank: rank } },
        { $sort: { __rank: 1, submitted_at: -1, _id: -1 } },
        {
          $facet: {
            items: [{ $skip: (page_number - 1) * page_size }, { $limit: page_size }, { $project: PUBLIC_PROJECTION }],
            total: [{ $count: "count" }],
          },
        },
      ],
      { allowDiskUse: true },
    )
    .toArray();
  return {
    items: (result && result.items) || [],
    total: result && result.total && result.total[0] ? result.total[0].count : 0,
  };
}

/** One page of the records whose key value contains the typed value on a searched key field, closest first. */
async function list_by_key_pair(form_group_id, field_ids, key, page, limit, with_record_key) {
  if (!key) return { items: [], total: 0 };
  return ranked_page(key_pair_filter(form_group_id, field_ids, key, with_record_key), pair_candidates(field_ids, with_record_key), key, page, limit);
}

/** How many records of the form hold a key value containing this one on this key field (or on any of these). */
async function count_by_key_pair(form_group_id, field_ids, key, with_record_key) {
  if (!key) return 0;
  return get_db().collection(COLLECTION_NAME).countDocuments(key_pair_filter(form_group_id, field_ids, key, with_record_key));
}

/**
 * The last resort of a lookup, when neither the pairs nor the whole key
 * hold the value: the key fields' own ANSWERS, searched the same way
 * (contains, whatever the letter case; a numeric value also as a number,
 * since a number field stores numbers), ranked the same way over the
 * answers lowercased and trimmed. Reads the form's records without an
 * index, which is why the caller re-stamps what this finds.
 */
async function list_by_data_value(form_group_id, field_ids, key, page, limit) {
  if (!key) return { items: [], total: 0 };
  const ids = Array.isArray(field_ids) ? field_ids : [field_ids];
  const matches = [contains_pattern(key)];
  if (/^[+-]?\d+(\.\d+)?$/.test(key)) matches.push(Number(key));
  const filter = { form_group_id, $or: ids.map((field_id) => ({ [`data.${field_id}`]: { $in: matches } })) };
  const candidates = ids.map((field_id) => ({
    $toLower: { $trim: { input: { $convert: { input: `$data.${field_id}`, to: "string", onError: "", onNull: "" } } } },
  }));
  return ranked_page(filter, candidates, key, page, limit);
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
 * Re-stamps a record's whole key, its searchable pairs and its marker
 * from its new answers after a full edit changed a key field - kept apart
 * from apply_record_update because a respondent update can never touch a
 * key, only a staff edit can.
 */
async function apply_record_key(submission_id, tracking, data) {
  const object_id = to_object_id(submission_id);
  if (!object_id) return false;
  const result = await get_db().collection(COLLECTION_NAME).updateOne({ _id: object_id }, { $set: key_fields_of(tracking, data || {}) });
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
  backfill_record_key_pairs,
  backfill_form_key_pairs,
  stamp_records_from_data,
  list_by_record_key,
  list_by_key_pair,
  list_by_data_value,
  count_by_key_pair,
  count_by_record_key,
  find_record,
  apply_record_update,
  apply_record_key,
  list_existing_record_keys,
  to_public_record,
};
