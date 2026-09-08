const { get_db } = require("../db_connection/db.js");

const COLLECTION_NAME = "dcs_form_approvers";
const INSERT_BATCH_SIZE = 1000;

// Internal per-document fields - never sent to a client.
const PUBLIC_PROJECTION = { _id: 0, form_group_id: 0, order: 0, match_values: 0, group_field_id: 0 };

/** Optional narrowing to specific cascade groups (deepest condition field). */
function pool_filter(form_group_id, group_field_ids) {
  const filter = { form_group_id };
  if (Array.isArray(group_field_ids) && group_field_ids.length > 0) {
    filter.group_field_id = { $in: group_field_ids };
  }
  return filter;
}

function normalize(value) {
  return String(value === undefined || value === null ? "" : value).trim().toLowerCase();
}

/**
 * Generated (test) approvers live here as one document each - the form's
 * own approval_config keeps only the hand-made approvers - so listing them
 * pages through a plain collection query (limit/skip/count), exactly like
 * every other paginated list in the system, and the form document never
 * grows past MongoDB's size limit no matter how big a pool is generated.
 */
async function ensure_form_approver_indexes() {
  const collection = get_db().collection(COLLECTION_NAME);
  await collection.createIndex({ form_group_id: 1, order: 1 }, { name: "form_group_order" });
  await collection.createIndex({ form_group_id: 1, match_values: 1 }, { name: "form_group_match_values" });
  await collection.createIndex({ form_group_id: 1, group_field_id: 1, order: 1 }, { name: "form_group_group_field" });
}

/**
 * Replaces a form's whole generated pool: previous generated approvers go,
 * the new ones come in stable order, each carrying match_values (its
 * conditions' normalized values) so submit-time routing can query only the
 * approvers a record can possibly match.
 */
async function replace_generated_approvers(form_group_id, approvers) {
  const collection = get_db().collection(COLLECTION_NAME);
  await collection.deleteMany({ form_group_id });
  let inserted = 0;
  for (let start = 0; start < approvers.length; start += INSERT_BATCH_SIZE) {
    const batch = approvers.slice(start, start + INSERT_BATCH_SIZE).map((approver, index) => {
      const conditions = approver.conditions || [];
      return Object.assign({}, approver, {
        form_group_id,
        order: start + index,
        match_values: conditions.map((condition) => normalize(condition.value)),
        // The group this approver belongs to: its deepest (last) condition
        // field - what the level-range filter narrows by.
        group_field_id: conditions.length > 0 ? conditions[conditions.length - 1].field_id : null,
      });
    });
    if (batch.length > 0) {
      const result = await collection.insertMany(batch, { ordered: false });
      inserted += result.insertedCount;
    }
  }
  return inserted;
}

/** One page, the standard way: find(filter).limit(limit).skip(skip).sort(...). */
async function list_generated_approvers(form_group_id, skip, limit, group_field_ids) {
  return get_db()
    .collection(COLLECTION_NAME)
    .find(pool_filter(form_group_id, group_field_ids), { projection: PUBLIC_PROJECTION })
    .limit(limit)
    .skip(skip)
    .sort({ order: 1 })
    .toArray();
}

async function count_generated_approvers(form_group_id, group_field_ids) {
  return get_db().collection(COLLECTION_NAME).countDocuments(pool_filter(form_group_id, group_field_ids));
}

/** Removes a form's whole generated pool - the "clear test approvals" action. */
async function delete_generated_approvers(form_group_id) {
  const result = await get_db().collection(COLLECTION_NAME).deleteMany({ form_group_id });
  return result.deletedCount;
}

/**
 * The generated approvers one submission can possibly match: every one of
 * an approver's condition values must appear among the record's own
 * normalized answer values. The exact per-field check still happens in
 * build_approval_state - this query just keeps a huge pool from ever being
 * loaded whole for one submission.
 */
async function find_matching_generated_approvers(form_group_id, record_values) {
  return get_db()
    .collection(COLLECTION_NAME)
    .find(
      { form_group_id, match_values: { $not: { $elemMatch: { $nin: record_values } } } },
      { projection: PUBLIC_PROJECTION },
    )
    .sort({ order: 1 })
    .toArray();
}

module.exports = {
  ensure_form_approver_indexes,
  replace_generated_approvers,
  list_generated_approvers,
  count_generated_approvers,
  delete_generated_approvers,
  find_matching_generated_approvers,
};
