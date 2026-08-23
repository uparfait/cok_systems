const { get_db } = require("../db_connection/db.js");

const COLLECTION_NAME = "dcs_submissions";

/**
 * Escapes a string so it can be used as a literal inside a regex, letting a
 * search term match case-insensitively without being read as its own regex
 * syntax.
 */
function escape_regex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every list_submissions() query filters by form_group_id (optionally also
 * by version) and sorts by submitted_at descending. Without an index
 * covering that, Mongo has to load and sort every matching document in
 * memory, which blows past the server's default 32MB in-memory sort limit
 * on any form with a meaningful amount of data, aborting the query
 * outright - true even now that uploaded files live on disk (referenced
 * here only by a small {name,type,size,url} object) rather than embedded
 * as base64, since a large enough form still means a lot of documents.
 * This index lets
 * Mongo serve both the equality filter and the sort order directly from
 * the index, with version (when present) applied as a residual filter over
 * the already-sorted-by-submitted_at index order - no in-memory sort at
 * any data size. Called once at startup; createIndex is a no-op if an
 * identical index already exists.
 */
async function ensure_submission_indexes() {
  await get_db().collection(COLLECTION_NAME).createIndex({ form_group_id: 1, submitted_at: -1 }, { name: "form_group_submitted_at" });
}

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
 * a single version and/or a submitted_at date range), sorted newest or
 * oldest first. Only passing a version scopes it to one specific,
 * immutable form version; leaving it out returns submissions collected
 * against every version.
 *
 * options.search, when set, matches against every field value a
 * submission actually has - done as an aggregation (rather than the plain
 * find() below) since MongoDB has no native way to text-search an object
 * whose own keys vary submission to submission. String/number/boolean
 * values are matched directly; a multi-select answer's array of strings is
 * joined and matched too. Only a file-upload answer (an object, not a
 * plain value) is skipped, since there's no meaningful text to search in
 * {name, type, size, url}.
 */
async function list_submissions(form_group_id, version, page, limit, date_bounds, options) {
  const filter = { form_group_id };
  if (version !== undefined && version !== null) filter.version = Number(version);
  if (date_bounds && date_bounds.start && date_bounds.end) {
    filter.submitted_at = { $gte: date_bounds.start, $lte: date_bounds.end };
  }

  const sort_direction = options && options.sort === "oldest" ? 1 : -1;
  const skip = (page - 1) * limit;
  const collection = get_db().collection(COLLECTION_NAME);
  const search_term = options && options.search ? options.search.toString().trim() : "";

  if (search_term) {
    const search_regex = new RegExp(escape_regex(search_term), "i");
    const pipeline = [
      { $match: filter },
      {
        $addFields: {
          __search_text: {
            $reduce: {
              input: { $objectToArray: { $ifNull: ["$data", {}] } },
              initialValue: "",
              in: {
                $concat: [
                  "$$value",
                  " ",
                  {
                    $switch: {
                      branches: [
                        { case: { $eq: [{ $type: "$$this.v" }, "string"] }, then: "$$this.v" },
                        {
                          case: { $in: [{ $type: "$$this.v" }, ["double", "int", "long", "decimal", "bool"]] },
                          then: { $toString: "$$this.v" },
                        },
                        {
                          // A multi-select answer: an array of strings (or
                          // occasionally numbers) - joined into one
                          // searchable string, same as the scalar branches
                          // above just applied per element.
                          case: { $eq: [{ $type: "$$this.v" }, "array"] },
                          then: {
                            $reduce: {
                              input: "$$this.v",
                              initialValue: "",
                              in: {
                                $concat: [
                                  "$$value",
                                  " ",
                                  {
                                    $switch: {
                                      branches: [
                                        { case: { $eq: [{ $type: "$$this" }, "string"] }, then: "$$this" },
                                        {
                                          case: { $in: [{ $type: "$$this" }, ["double", "int", "long", "decimal", "bool"]] },
                                          then: { $toString: "$$this" },
                                        },
                                      ],
                                      default: "",
                                    },
                                  },
                                ],
                              },
                            },
                          },
                        },
                      ],
                      default: "",
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $match: { __search_text: search_regex } },
      { $sort: { submitted_at: sort_direction } },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }, { $project: { __search_text: 0 } }],
          total_count: [{ $count: "count" }],
        },
      },
    ];
    const [result] = await collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
    return {
      items: (result && result.items) || [],
      total: (result && result.total_count && result.total_count[0] && result.total_count[0].count) || 0,
    };
  }

  const [items, total] = await Promise.all([
    // allowDiskUse is a defensive fallback, not the fix itself - the index
    // above already keeps this off the in-memory sort path entirely; this
    // only matters for the brief window before that index finishes
    // building on an existing large collection.
    collection.find(filter).sort({ submitted_at: sort_direction }).skip(skip).limit(limit).allowDiskUse(true).toArray(),
    collection.countDocuments(filter),
  ]);

  return { items, total };
}

/**
 * Total submissions ever collected for a form, across every version - the
 * form overview's all-time "total data collected" stat.
 */
async function count_by_form_group_id(form_group_id) {
  return get_db().collection(COLLECTION_NAME).countDocuments({ form_group_id });
}

/**
 * Just the submitted_at of every submission for a form within a date range
 * (or every one it has, when no range is given) - backs the submissions
 * time-series chart, which only ever needs the timestamp to bucket by.
 */
async function list_submitted_at_within(form_group_id, start, end) {
  const filter = { form_group_id };
  if (start && end) filter.submitted_at = { $gte: start, $lte: end };
  return get_db()
    .collection(COLLECTION_NAME)
    .find(filter, { projection: { submitted_at: 1 } })
    .toArray();
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
  ensure_submission_indexes,
  create_submission,
  find_by_client_submission_id,
  list_submissions,
  count_by_form_group_id,
  list_submitted_at_within,
  delete_by_form_group_ids,
  count_submissions_for_version,
  delete_by_form_group_and_version,
};
