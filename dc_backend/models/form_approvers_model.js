const { get_db } = require("../db_connection/db.js");

const COLLECTION_NAME = "dcs_form_approvers";
const FORMS_COLLECTION_NAME = "dcs_forms";
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

const PAGE_PROJECTION = { _id: 0, form_group_id: 0, order: 0, match_values: 0, group_field_id: 0, __sort: 0 };
const CONFIG_SORT_OFFSET = 1000000000;

// One document stream holding EVERY approver of a form - the hand-made ones
// unwound straight out of the form's own approval_config (sorted first) and
// the generated pool union-ed in after them. Built once, so both the page
// and the total come from MongoDB's own operators ($skip/$limit/$count) in
// a single query - nothing is counted, sliced or merged in code.
function all_approvers_pipeline(form_group_id, version) {
  return [
    { $match: { form_group_id, version: Number(version) } },
    { $limit: 1 },
    { $unwind: { path: "$approval_config.approvers", includeArrayIndex: "__config_index" } },
    {
      $replaceRoot: {
        newRoot: { $mergeObjects: ["$approval_config.approvers", { __sort: { $subtract: ["$__config_index", CONFIG_SORT_OFFSET] } }] },
      },
    },
    {
      $unionWith: {
        coll: COLLECTION_NAME,
        pipeline: [{ $match: { form_group_id } }, { $addFields: { __sort: "$order" } }],
      },
    },
    { $sort: { __sort: 1 } },
  ];
}

/**
 * One page of a form's approvers plus the total, in one native aggregation:
 * MongoDB's $skip/$limit pick the page and $count produces the total. A
 * cascade-level filter narrows to the generated pool alone (hand-made
 * approvers carry no group).
 */
async function page_all_approvers(form_group_id, version, skip, limit, group_field_ids) {
  const facet = {
    $facet: {
      total: [{ $count: "count" }],
      page: [{ $skip: skip }, { $limit: Math.max(1, limit) }, { $project: PAGE_PROJECTION }],
    },
  };
  const filtered = Array.isArray(group_field_ids) && group_field_ids.length > 0;
  const pipeline = filtered
    ? [{ $match: pool_filter(form_group_id, group_field_ids) }, { $sort: { order: 1 } }, facet]
    : all_approvers_pipeline(form_group_id, version).concat([facet]);
  const collection = get_db().collection(filtered ? COLLECTION_NAME : FORMS_COLLECTION_NAME);
  const [result] = await collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
  return {
    total: (result && result.total && result.total[0] && result.total[0].count) || 0,
    approvers: (result && result.page) || [],
  };
}


/** The form's whole approver total (hand-made + generated), counted by MongoDB itself. */
async function count_all_approvers(form_group_id, version) {
  const pipeline = all_approvers_pipeline(form_group_id, version).concat([{ $count: "count" }]);
  const [result] = await get_db().collection(FORMS_COLLECTION_NAME).aggregate(pipeline, { allowDiskUse: true }).toArray();
  return (result && result.count) || 0;
}

/** Removes a form's whole generated pool - the "clear test approvals" action. */
/** How many generated approvers a form holds - zero means routing needs no per-record lookup. */
async function count_generated_approvers(form_group_id) {
  return get_db().collection(COLLECTION_NAME).countDocuments({ form_group_id });
}

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
  page_all_approvers,
  count_all_approvers,
  count_generated_approvers,
  delete_generated_approvers,
  find_matching_generated_approvers,
};
