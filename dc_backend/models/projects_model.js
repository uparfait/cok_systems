const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");

const COLLECTION_NAME = "dcs_projects";

/**
 * Shared by list_projects() and find_project_with_stats() so both ever
 * compute forms_count and total_submissions the exact same way. Kept out of
 * plain find_project_by_id() - that one is called on nearly every project
 * request (access checks, form creation, delete, update) and has no use for
 * either total, so it stays a single cheap findOne instead of paying for
 * these joins on every one of those calls. forms_count is a one-hop join to
 * dcs_forms (distinct form_group_id per project);
 * total_submissions is a two-hop join (project -> its form groups -> their
 * submissions) done as a $lookup nested inside that first $lookup's own
 * pipeline, since Mongo has no native multi-collection join - counting via
 * a $count sub-pipeline per form group keeps full submission documents from
 * ever being materialized just to size an array.
 */
const PROJECT_STATS_STAGES = [
  {
    $lookup: {
      from: "dcs_forms",
      let: { project_id_str: { $toString: "$_id" } },
      pipeline: [
        { $match: { $expr: { $eq: ["$project_id", "$$project_id_str"] } } },
        { $group: { _id: "$form_group_id" } },
        {
          $lookup: {
            from: "dcs_submissions",
            let: { form_group_id: "$_id" },
            pipeline: [{ $match: { $expr: { $eq: ["$form_group_id", "$$form_group_id"] } } }, { $count: "count" }],
            as: "submission_count_doc",
          },
        },
        {
          $addFields: {
            submission_count: { $ifNull: [{ $arrayElemAt: ["$submission_count_doc.count", 0] }, 0] },
          },
        },
        {
          $group: {
            _id: null,
            forms_count: { $sum: 1 },
            total_submissions: { $sum: "$submission_count" },
          },
        },
      ],
      as: "stats_lookup",
    },
  },
  {
    $addFields: {
      forms_count: { $ifNull: [{ $arrayElemAt: ["$stats_lookup.forms_count", 0] }, 0] },
      total_submissions: { $ifNull: [{ $arrayElemAt: ["$stats_lookup.total_submissions", 0] }, 0] },
    },
  },
  { $project: { stats_lookup: 0 } },
];

/**
 * Inserts a new project document.
 */
async function create_project(project_data) {
  const now = new Date();
  const document = Object.assign({}, project_data, { created_at: now, updated_at: now });
  const result = await get_db().collection(COLLECTION_NAME).insertOne(document);
  return Object.assign({ _id: result.insertedId }, document);
}

/**
 * Lists every project, most recently updated first, each annotated with its
 * own forms_count and total_submissions. Computed here in one aggregation so
 * the sidebar and header can show every project's totals from this single
 * query, instead of one extra request per project.
 */
async function list_projects() {
  return get_db()
    .collection(COLLECTION_NAME)
    .aggregate([{ $sort: { updated_at: -1 } }, ...PROJECT_STATS_STAGES])
    .toArray();
}

/**
 * Finds a single project by its identifier - the fast path, no stats.
 */
async function find_project_by_id(project_id) {
  const object_id = to_object_id(project_id);
  if (!object_id) return null;
  return get_db().collection(COLLECTION_NAME).findOne({ _id: object_id });
}

/**
 * Same lookup, annotated with the same forms_count/total_submissions totals
 * as list_projects() - only the project detail page's stat cards need
 * either, so only that endpoint pays for the extra joins.
 */
async function find_project_with_stats(project_id) {
  const object_id = to_object_id(project_id);
  if (!object_id) return null;
  const results = await get_db()
    .collection(COLLECTION_NAME)
    .aggregate([{ $match: { _id: object_id } }, ...PROJECT_STATS_STAGES])
    .toArray();
  return results[0] || null;
}

/**
 * Batch-fetches specific projects by id, no stats - for a caller that
 * already knows exactly which projects it needs (e.g. resolving access for
 * a handful of forms-search matches) rather than every project that exists.
 */
async function find_projects_by_ids(project_ids) {
  const object_ids = (project_ids || []).map((id) => to_object_id(id)).filter(Boolean);
  if (object_ids.length === 0) return [];
  return get_db().collection(COLLECTION_NAME).find({ _id: { $in: object_ids } }).toArray();
}

/**
 * Applies a partial update to a project and returns the refreshed document.
 */
async function update_project(project_id, updates) {
  const object_id = to_object_id(project_id);
  if (!object_id) return null;
  const patch = Object.assign({}, updates, { updated_at: new Date() });
  await get_db().collection(COLLECTION_NAME).updateOne({ _id: object_id }, { $set: patch });
  return find_project_by_id(project_id);
}

/**
 * Permanently removes a project document. Its forms and collected data are
 * removed separately by the caller before this runs.
 */
async function delete_project(project_id) {
  const object_id = to_object_id(project_id);
  if (!object_id) return false;
  const result = await get_db().collection(COLLECTION_NAME).deleteOne({ _id: object_id });
  return result.deletedCount > 0;
}

module.exports = {
  create_project,
  list_projects,
  find_project_by_id,
  find_project_with_stats,
  find_projects_by_ids,
  update_project,
  delete_project,
};
