const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");
const { tracking_stages } = require("../util-dashboard/tracking_stage.js");

const COLLECTION_NAME = "dcs_submissions";

// Internal marker stamped on every generated test record. Deliberately
// obscure so no real form field can ever collide with it, and stripped from
// every response body before submissions reach the frontend.
const TEST_DATA_FLAG = "is_test_data_generated_sss_ddd";

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
  // The approver dashboard lists every submission routed to one email across all forms.
  await get_db().collection(COLLECTION_NAME).createIndex({ "approval.steps.email": 1, submitted_at: -1 }, { name: "approval_steps_email" });
}

/**
 * Stores a validated submission, permanently linked to the exact form
 * group and version it was collected against.
 */
async function create_submission(submission_data) {
  // A caller that stamped the time itself (a tracked record, whose first
  // value period starts at that very moment) keeps it.
  const document = Object.assign({}, submission_data, { submitted_at: submission_data.submitted_at instanceof Date ? submission_data.submitted_at : new Date() });
  const result = await get_db().collection(COLLECTION_NAME).insertOne(document);
  return Object.assign({ _id: result.insertedId }, document);
}

/** Finds the submission owning an approval step token - the token is the approver's whole credential. */
async function find_by_approval_token(token) {
  if (!token) return null;
  return get_db().collection(COLLECTION_NAME).findOne({ "approval.steps.token": token });
}

/**
 * Every submission routed to one approver email (newest first), backing the
 * authenticated "my approvals" dashboard. Capped so one very busy approver
 * can never pull the whole collection into memory at once.
 */
async function list_by_approver_email(email, limit) {
  if (!email) return [];
  return get_db()
    .collection(COLLECTION_NAME)
    .find({ "approval.steps.email": email.toString().trim().toLowerCase() })
    .sort({ submitted_at: -1 })
    .limit(limit || 300)
    .toArray();
}

/**
 * One scroll batch of an approver's submissions for a single form version
 * (newest first), plus the total so the dashboard knows when to stop asking.
 */
async function list_by_approver_email_page(email, form_group_id, version, skip, limit, decided_cutoff) {
  if (!email) return { items: [], total: 0 };
  const normalized_email = email.toString().trim().toLowerCase();
  const filter = { "approval.steps.email": normalized_email, form_group_id };
  if (version !== undefined && version !== null) filter.version = Number(version);

  // This approver's own step decides both the ordering and the retention
  // cut: still-to-act records come first oldest-first, everything already
  // decided sinks below them, and decisions older than the form's window
  // drop off the dashboard entirely.
  const my_steps = { $filter: { input: { $ifNull: ["$approval.steps", []] }, as: "step", cond: { $eq: ["$$step.email", normalized_email] } } };
  const pipeline = [
    { $match: filter },
    { $addFields: { dcs_my_steps: my_steps } },
    {
      $addFields: {
        dcs_my_step: {
          $ifNull: [
            { $arrayElemAt: [{ $filter: { input: "$dcs_my_steps", as: "step", cond: { $eq: ["$$step.status", "pending"] } } }, 0] },
            { $arrayElemAt: ["$dcs_my_steps", -1] },
          ],
        },
      },
    },
    {
      $addFields: {
        // Decided means this approver has nothing left to do on it: either
        // their own step is settled, or the whole approval already closed.
        dcs_is_decided: {
          $cond: [
            {
              $or: [
                { $in: [{ $ifNull: ["$dcs_my_step.status", "pending"] }, ["approved", "rejected", "skipped"]] },
                { $ne: [{ $ifNull: ["$approval.status", "pending"] }, "pending"] },
              ],
            },
            1,
            0,
          ],
        },
        dcs_decided_at: {
          $ifNull: ["$dcs_my_step.acted_at", { $ifNull: ["$approval.completed_at", "$submitted_at"] }],
        },
      },
    },
  ];
  if (decided_cutoff) {
    pipeline.push({ $match: { $or: [{ dcs_is_decided: 0 }, { dcs_decided_at: { $gte: decided_cutoff } }] } });
  }
  pipeline.push({ $sort: { dcs_is_decided: 1, submitted_at: 1, _id: 1 } });
  pipeline.push({
    $facet: {
      items: [{ $skip: skip }, { $limit: limit }, { $project: { dcs_my_steps: 0, dcs_my_step: 0, dcs_is_decided: 0, dcs_decided_at: 0 } }],
      total: [{ $count: "count" }],
    },
  });

  const [result] = await get_db().collection(COLLECTION_NAME).aggregate(pipeline).toArray();
  const items = (result && result.items) || [];
  const total = result && result.total && result.total[0] ? result.total[0].count : 0;
  return { items, total };
}

/**
 * Every form version routed to one approver with its record count, newest
 * submission first - feeds the dashboard's form picker without loading records.
 */
async function list_form_versions_by_approver_email(email) {
  if (!email) return [];
  return get_db()
    .collection(COLLECTION_NAME)
    .aggregate([
      { $match: { "approval.steps.email": email.toString().trim().toLowerCase() } },
      { $group: { _id: { form_group_id: "$form_group_id", version: "$version" }, count: { $sum: 1 }, latest: { $max: "$submitted_at" } } },
      { $sort: { latest: -1 } },
    ])
    .toArray()
    .then((groups) => groups.map((group) => ({ form_group_id: group._id.form_group_id, version: group._id.version, count: group.count })));
}

/** Persists a submission's whole updated approval state after a decision. */
async function update_submission_approval(submission_id, approval) {
  await get_db().collection(COLLECTION_NAME).updateOne({ _id: submission_id }, { $set: { approval } });
}

/** One offset+limit page of a batch, oldest first, with the batch total. */
async function list_by_approval_request_page(request_id, skip, limit, decided_ids) {
  const collection = get_db().collection(COLLECTION_NAME);
  const decided = (decided_ids || []).map((id) => to_object_id(id.toString()));
  // Same ordering rule as the approver dashboard: what still needs a
  // decision comes first, oldest first, and what this approver already
  // settled sinks below it.
  const pipeline = [
    { $match: { approval_request_id: request_id } },
    { $addFields: { dcs_is_decided: { $cond: [{ $in: ["$_id", decided] }, 1, 0] } } },
    { $sort: { dcs_is_decided: 1, submitted_at: 1, _id: 1 } },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }, { $project: { dcs_is_decided: 0 } }],
        total: [{ $count: "count" }],
      },
    },
  ];
  const [result] = await collection.aggregate(pipeline).toArray();
  return {
    items: (result && result.items) || [],
    total: result && result.total && result.total[0] ? result.total[0].count : 0,
  };
}
/** Just the ids a batch covers - the per-record decision completeness check. */
async function list_ids_by_approval_request(request_id) {
  const documents = await get_db()
    .collection(COLLECTION_NAME)
    .find({ approval_request_id: request_id }, { projection: { _id: 1 } })
    .toArray();
  return documents.map((document) => document._id);
}
/**
 * The ids of every submission of a form not yet covered by any batch
 * approval request - exactly the records a newly fired "send to approvers"
 * batch will cover.
 */
async function list_ids_without_approval_request(form_group_id) {
  const documents = await get_db()
    .collection(COLLECTION_NAME)
    .find({ form_group_id, approval_request_id: { $exists: false } }, { projection: { _id: 1 } })
    .toArray();
  return documents.map((document) => document._id);
}

/** How many submissions of a form no batch covers yet - what a recurring "after N responses" trigger counts. */
async function count_without_approval_request(form_group_id) {
  return get_db()
    .collection(COLLECTION_NAME)
    .countDocuments({ form_group_id, approval_request_id: { $exists: false } });
}

/** Stamps a fired batch onto every submission it covers. */
async function assign_approval_request(submission_ids, request_id) {
  if (!submission_ids || submission_ids.length === 0) return;
  await get_db()
    .collection(COLLECTION_NAME)
    .updateMany({ _id: { $in: submission_ids } }, { $set: { approval_request_id: request_id } });
}

/** The full documents of every submission one batch covers, oldest first - the approver's review view. */
async function list_by_approval_request(request_id, limit) {
  return get_db()
    .collection(COLLECTION_NAME)
    .find({ approval_request_id: request_id })
    .sort({ submitted_at: 1 })
    .limit(limit || 500)
    .toArray();
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
/**
 * Column value filters as the data table sends them: { field_id: [value,
 * ...] }. A value matches whether the answer is that value or an array
 * holding it, which is what Mongo's $in already does on both shapes, so a
 * single/multi select column filters the same way. An empty list for a
 * field means that column is not filtering at all.
 */
function apply_value_filters(filter, filters) {
  if (!filters || typeof filters !== "object") return filter;
  Object.keys(filters).forEach((field_id) => {
    const values = filters[field_id];
    if (!Array.isArray(values) || values.length === 0) return;
    filter[`data.${field_id}`] = { $in: values };
  });
  return filter;
}

/**
 * Free-text search has to reach EVERY answer a record holds, whatever
 * shape it was stored in - a form's own fields vary record to record, so
 * there is nothing to index by name and the text has to be assembled per
 * document. Aggregation has no recursion, so this covers the shapes
 * answers actually take: a plain value, a list of them (multi-select,
 * ranking), and an object (an uploaded file's name and type, a
 * geolocation's address) - including a list OF objects.
 *
 * Who filled the record in and which version it was collected on are
 * folded in too, so searching a respondent's name or a version number
 * finds the record the same way searching an answer does.
 */
const SEARCHABLE_NUMERIC_TYPES = ["double", "int", "long", "decimal", "bool"];

/** One plain value as text; anything with no readable form becomes "". */
function scalar_text(value_expression) {
  return {
    $switch: {
      branches: [
        { case: { $eq: [{ $type: value_expression }, "string"] }, then: value_expression },
        { case: { $in: [{ $type: value_expression }, SEARCHABLE_NUMERIC_TYPES] }, then: { $toString: value_expression } },
        { case: { $eq: [{ $type: value_expression }, "date"] }, then: { $dateToString: { date: value_expression, format: "%Y-%m-%d %H:%M" } } },
      ],
      default: "",
    },
  };
}

/** Every value an object holds, run together - a file's name and type, a place's address. */
function object_text(object_expression) {
  return {
    $reduce: {
      input: { $objectToArray: object_expression },
      initialValue: "",
      in: { $concat: ["$value", " ", scalar_text("$this.v")] },
    },
  };
}

/** One answer of any shape as searchable text. */
function answer_text(value_expression) {
  return {
    $let: {
      vars: { entry: value_expression },
      in: {
        $switch: {
          branches: [
            {
              case: { $isArray: "$entry" },
              then: {
                $reduce: {
                  input: "$entry",
                  initialValue: "",
                  in: {
                    $concat: [
                      "$value",
                      " ",
                      {
                        $cond: [{ $eq: [{ $type: "$this" }, "object"] }, object_text("$this"), scalar_text("$this")],
                      },
                    ],
                  },
                },
              },
            },
            { case: { $eq: [{ $type: "$entry" }, "object"] }, then: object_text("$entry") },
          ],
          default: scalar_text("$entry"),
        },
      },
    },
  };
}

const SEARCH_TEXT_EXPRESSION = {
  $concat: [
    {
      $reduce: {
        input: { $objectToArray: { $ifNull: ["$data", {}] } },
        initialValue: "",
        in: { $concat: ["$value", " ", answer_text("$this.v")] },
      },
    },
    " ",
    { $ifNull: ["$respondent.name", ""] },
    " ",
    { $ifNull: ["$respondent.email", ""] },
    " ",
    { $ifNull: ["$respondent.phone", ""] },
    " ",
    scalar_text("$version"),
    " ",
    scalar_text("$submitted_at"),
  ],
};

async function list_submissions(form_group_id, version, page, limit, date_bounds, options) {
  const filter = { form_group_id };
  // Opening ONE record in the table (what the gallery does when a
  // picture is followed back to the row it came from): the id narrows
  // the same query every other filter narrows, so the row still arrives
  // with its approval state and its version beside it.
  if (options && options.submission_id) {
    const object_id = to_object_id(options.submission_id);
    if (!object_id) return { items: [], total: 0 };
    filter._id = object_id;
  }
  if (version !== undefined && version !== null) filter.version = Number(version);
  // A tracked form is a register: inside a period it lists every record
  // that EXISTED by the period's end - one recorded before the period
  // began is still there during it - and shows each updatable field as it
  // stood at that end (see util-dashboard/tracking_stage.js), the same
  // reading the dashboards give. Any other form lists what was submitted
  // inside the period.
  const tracked = !!(options && options.tracking && options.tracking.enabled === true);
  if (date_bounds && date_bounds.start && date_bounds.end && !filter._id) {
    filter.submitted_at = tracked ? { $lte: date_bounds.end } : { $gte: date_bounds.start, $lte: date_bounds.end };
  }
  // The column filters are applied after the as-of rewrite, on the values
  // actually shown.
  const as_of_stages = filter._id ? [] : tracking_stages({ tracking: options && options.tracking }, date_bounds);
  const value_filter = {};
  apply_value_filters(value_filter, options && options.filters);
  // A pinned record answers for itself: the date range, the version and
  // the column filters around it would only ever hide the one row that
  // was explicitly asked for.
  if (!filter._id && as_of_stages.length === 0) Object.assign(filter, value_filter);
  const value_stages = !filter._id && as_of_stages.length > 0 && Object.keys(value_filter).length > 0 ? [{ $match: value_filter }] : [];

  const sort_direction = options && options.sort === "oldest" ? 1 : -1;
  const skip = (page - 1) * limit;
  const collection = get_db().collection(COLLECTION_NAME);
  const search_term = options && options.search ? options.search.toString().trim() : "";

  if (search_term || as_of_stages.length > 0) {
    const search_stages = search_term
      ? [{ $addFields: { __search_text: SEARCH_TEXT_EXPRESSION } }, { $match: { __search_text: new RegExp(escape_regex(search_term), "i") } }]
      : [];
    const pipeline = [
      { $match: filter },
      ...as_of_stages,
      ...value_stages,
      ...search_stages,
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

function range_filter(form_group_id, bounds) {
  const filter = { form_group_id };
  if (bounds && bounds.start && bounds.end) filter.submitted_at = { $gte: bounds.start, $lte: bounds.end };
  return filter;
}

/** How many submissions an export over this range will write. */
async function count_in_range(form_group_id, bounds) {
  return get_db().collection(COLLECTION_NAME).countDocuments(range_filter(form_group_id, bounds));
}

/**
 * Every submission of the range as ONE cursor, oldest first, only the
 * fields an export writes - streamed in batches instead of page after page
 * of skip/limit queries.
 */
function stream_in_range(form_group_id, bounds, batch_size) {
  return get_db()
    .collection(COLLECTION_NAME)
    .find(range_filter(form_group_id, bounds), { projection: { data: 1, version: 1, submitted_at: 1, respondent: 1 } })
    .sort({ submitted_at: 1 })
    .batchSize(batch_size || 1000);
}

/** The data feed's filter: a form, an optional version and an optional submitted_at window. */
function feed_query(form_group_id, filter) {
  const query = { form_group_id };
  if (filter && Number.isFinite(filter.version)) query.version = filter.version;
  if (filter && (filter.start || filter.end)) {
    query.submitted_at = {};
    if (filter.start) query.submitted_at.$gte = filter.start;
    if (filter.end) query.submitted_at.$lte = filter.end;
  }
  return query;
}

async function count_feed(form_group_id, filter) {
  return get_db().collection(COLLECTION_NAME).countDocuments(feed_query(form_group_id, filter));
}

/**
 * A page (or, with limit 0, everything) of the feed as a cursor, oldest
 * first. The sort rides the form_group_submitted_at index; disk use is the
 * safety net for a window the index cannot fully serve, so a large form
 * never fails with the in-memory sort limit.
 */
function stream_feed(form_group_id, filter, skip, limit, batch_size) {
  let cursor = get_db()
    .collection(COLLECTION_NAME)
    .find(feed_query(form_group_id, filter), { projection: { data: 1, version: 1, submitted_at: 1, respondent: 1 } })
    .sort({ submitted_at: 1 })
    .allowDiskUse(true)
    .batchSize(batch_size || 1000);
  if (skip) cursor = cursor.skip(skip);
  if (limit) cursor = cursor.limit(limit);
  return cursor;
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
/**
 * The submissions-over-time chart, counted BY THE DATABASE: one row per
 * time bucket with how many records fall in it, instead of pulling every
 * timestamp in the range back to count them here. A form with a year of
 * records behind it would otherwise ship tens of thousands of documents
 * over the wire just to produce twelve numbers.
 *
 * granularity is one of hour/day/week/month/year. offset_minutes is the
 * reader's own distance from UTC, so a day ends where they are rather
 * than at UTC midnight; it is handed to $dateTrunc as a fixed offset,
 * which is exact for a zone without daylight saving.
 */
const GRANULARITY_UNITS = { hour: "hour", day: "day", week: "week", month: "month", year: "year" };

function utc_offset_string(offset_minutes) {
  const total = Number.isFinite(offset_minutes) ? Math.trunc(offset_minutes) : 0;
  const sign = total < 0 ? "-" : "+";
  const absolute = Math.abs(total);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

async function count_submissions_over_time(form_group_id, start, end, granularity, offset_minutes, week_start_day) {
  const match = { form_group_id };
  if (start && end) match.submitted_at = { $gte: start, $lte: end };

  const truncate = {
    date: "$submitted_at",
    unit: GRANULARITY_UNITS[granularity] || "day",
    timezone: utc_offset_string(offset_minutes),
  };
  // A week bucket has to begin on the same weekday the chosen range
  // begins on, so the first column is never a week that started before
  // what was picked.
  if (granularity === "week" && week_start_day) truncate.startOfWeek = week_start_day;

  const rows = await get_db()
    .collection(COLLECTION_NAME)
    .aggregate(
      [
        { $match: match },
        { $group: { _id: { $dateTrunc: truncate }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ],
      { allowDiskUse: true },
    )
    .toArray();

  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return { buckets: rows.map((row) => ({ at: row._id, count: row.count })), total };
}

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
 * One specific submission by its own id, or null if it doesn't exist -
 * looked up first so a delete can check which form (and therefore which
 * project's permissions) it actually belongs to before removing it.
 */
async function find_submission_by_id(submission_id) {
  const object_id = to_object_id(submission_id);
  if (!object_id) return null;
  return get_db().collection(COLLECTION_NAME).findOne({ _id: object_id });
}

/**
 * Permanently removes one specific submission. Irreversible - the caller
 * has already confirmed which form it belongs to and that the requesting
 * user may manage that form's data.
 */
async function delete_submission_by_id(submission_id) {
  const object_id = to_object_id(submission_id);
  if (!object_id) return false;
  const result = await get_db().collection(COLLECTION_NAME).deleteOne({ _id: object_id });
  return result.deletedCount > 0;
}

/**
 * Number of submissions collected against one specific form version - used
 * to warn an author how much data a version delete would also remove.
 */
/**
 * Permanently removes a hand-picked set of submissions in one write - what
 * the data table's "delete selected" does. The caller has already checked
 * that every id belongs to a form the requesting user may manage.
 */
async function delete_submissions_by_ids(submission_ids) {
  const object_ids = (submission_ids || []).map((id) => to_object_id(id)).filter(Boolean);
  if (object_ids.length === 0) return 0;
  const result = await get_db().collection(COLLECTION_NAME).deleteMany({ _id: { $in: object_ids } });
  return result.deletedCount;
}

/**
 * The submissions a hand-picked set of ids resolves to, carrying only what
 * a permission check needs - so "delete selected" can verify every row in
 * one query instead of one round trip per row.
 */
async function find_submissions_by_ids(submission_ids) {
  const object_ids = (submission_ids || []).map((id) => to_object_id(id)).filter(Boolean);
  if (object_ids.length === 0) return [];
  return get_db()
    .collection(COLLECTION_NAME)
    .find({ _id: { $in: object_ids } }, { projection: { form_group_id: 1, project_id: 1 } })
    .toArray();
}

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

/**
 * Bulk-inserts generated test submissions exactly as given - each document
 * already carries its own spread-out submitted_at and the TEST_DATA_FLAG,
 * unlike create_submission which always stamps "now".
 */
async function insert_test_submissions(documents) {
  if (!documents || documents.length === 0) return 0;
  const result = await get_db().collection(COLLECTION_NAME).insertMany(documents, { ordered: false });
  return result.insertedCount;
}

/**
 * Permanently removes generated test records of one form - never a real
 * submission, the flag filter is unconditional. start/end narrow by
 * submitted_at and version narrows to one form version; either is optional.
 */
async function delete_test_submissions(form_group_id, start, end, version) {
  const filter = { form_group_id, [TEST_DATA_FLAG]: true };
  if (start && end) filter.submitted_at = { $gte: start, $lte: end };
  if (version !== undefined && version !== null && version !== "") filter.version = Number(version);
  const result = await get_db().collection(COLLECTION_NAME).deleteMany(filter);
  return result.deletedCount;
}

/** Every generated test record of a form - id and answers only, for building test approvals. */
async function list_test_submissions(form_group_id) {
  return get_db()
    .collection(COLLECTION_NAME)
    .find({ form_group_id, [TEST_DATA_FLAG]: true }, { projection: { data: 1, approval: 1 } })
    .toArray();
}

/** Writes one generated approval state per submission in a single bulk operation. */
async function set_test_approvals(entries) {
  if (!entries || entries.length === 0) return 0;
  const result = await get_db()
    .collection(COLLECTION_NAME)
    .bulkWrite(
      entries.map((entry) => ({
        updateOne: { filter: { _id: entry._id }, update: { $set: { approval: entry.approval } } },
      })),
      { ordered: false },
    );
  return result.modifiedCount;
}

/**
 * Removes every generated test approval of a form - only ever touches test
 * records whose approval state itself carries the test marker, so a real
 * submission's approval flow can never be wiped by this.
 */
async function clear_test_approvals(form_group_id) {
  const result = await get_db()
    .collection(COLLECTION_NAME)
    .updateMany(
      { form_group_id, [TEST_DATA_FLAG]: true, "approval.is_test_approval_sss_ddd": true },
      { $set: { approval: null } },
    );
  return result.modifiedCount;
}

module.exports = {
  TEST_DATA_FLAG,
  ensure_submission_indexes,
  create_submission,
  insert_test_submissions,
  delete_test_submissions,
  list_test_submissions,
  set_test_approvals,
  clear_test_approvals,
  list_ids_without_approval_request,
  count_without_approval_request,
  assign_approval_request,
  list_by_approval_request,
  list_ids_by_approval_request,
  list_by_approval_request_page,
  find_by_approval_token,
  list_by_approver_email,
  list_by_approver_email_page,
  list_form_versions_by_approver_email,
  update_submission_approval,
  find_by_client_submission_id,
  find_submission_by_id,
  list_submissions,
  apply_value_filters,
  count_by_form_group_id,
  list_submitted_at_within,
  count_submissions_over_time,
  count_in_range,
  stream_in_range,
  count_feed,
  stream_feed,
  delete_by_form_group_ids,
  count_submissions_for_version,
  delete_by_form_group_and_version,
  delete_submission_by_id,
  delete_submissions_by_ids,
  find_submissions_by_ids,
};
