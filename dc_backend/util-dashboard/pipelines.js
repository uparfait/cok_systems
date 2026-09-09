const { get_db } = require("../db_connection/db.js");
const { build_match_stage, numeric_expr } = require("./match_stage.js");
const { is_multi_value } = require("./field_catalog.js");
const { LIMITS, SUBMITTED_AT_FIELD } = require("./constants.js");

const SUBMISSIONS_COLLECTION = "dcs_submissions";

/**
 * Native MongoDB aggregation pipelines for every widget kind. All grouping,
 * counting and summing happens inside the database; the callers only ever
 * reshape already-aggregated rows into chart series.
 */

function run_pipeline(pipeline) {
  return get_db().collection(SUBMISSIONS_COLLECTION).aggregate(pipeline).toArray();
}

/**
 * The accumulator of a widget metric: plain counting, or a numeric
 * aggregation over one field converted safely to a double.
 */
function metric_accumulator(metric) {
  const aggregation = (metric && metric.aggregation) || "count";
  if (aggregation === "count") return { $sum: 1 };
  const operator = { sum: "$sum", avg: "$avg", min: "$min", max: "$max" }[aggregation];
  return { [operator]: numeric_expr(metric.field_id) };
}

/**
 * Multi-value fields (multi select) store arrays - each entry counts on its
 * own, so their pipelines unwind the path before grouping.
 */
function unwind_stages(catalog, field_ids) {
  return field_ids
    .filter((field_id) => is_multi_value(catalog, field_id))
    .map((field_id) => ({ $unwind: { path: `$data.${field_id}`, preserveNullAndEmptyArrays: false } }));
}

/**
 * Rows of one categorical field: [{_id: <value>, value: <aggregate>}],
 * already sorted by the database. Null groups (records that never answered
 * the field) are dropped inside the pipeline.
 */
async function category_rows(widget, bounds, catalog) {
  const group_field = widget.group_by.field_id;
  const sort =
    widget.sort === "label_asc" ? { _id: 1 } : widget.sort === "value_asc" ? { value: 1, _id: 1 } : { value: -1, _id: 1 };
  const pipeline = [
    build_match_stage(widget, bounds),
    ...unwind_stages(catalog, [group_field]),
    { $match: { [`data.${group_field}`]: { $nin: [null, ""] } } },
    { $group: { _id: `$data.${group_field}`, value: metric_accumulator(widget.metric) } },
    { $match: { value: { $ne: null } } },
    { $sort: sort },
    { $limit: LIMITS.MAX_CATEGORY_LIMIT + 1 },
  ];
  return run_pipeline(pipeline);
}

/**
 * Rows of a categorical field split by a second one:
 * [{_id: {g, s}, value}] - the matrix a grouped/stacked chart or heatmap is
 * pivoted from.
 */
async function split_rows(widget, bounds, catalog) {
  const group_field = widget.group_by.field_id;
  const split_field = widget.split_by.field_id;
  const pipeline = [
    build_match_stage(widget, bounds),
    ...unwind_stages(catalog, [group_field, split_field]),
    { $match: { [`data.${group_field}`]: { $nin: [null, ""] }, [`data.${split_field}`]: { $nin: [null, ""] } } },
    {
      $group: {
        _id: { g: `$data.${group_field}`, s: `$data.${split_field}` },
        value: metric_accumulator(widget.metric),
      },
    },
    { $match: { value: { $ne: null } } },
    { $sort: { "_id.g": 1, "_id.s": 1 } },
    { $limit: LIMITS.MAX_CATEGORY_LIMIT * LIMITS.MAX_CATEGORY_LIMIT },
  ];
  return run_pipeline(pipeline);
}

/**
 * The submitted date expression of a time widget: submitted_at itself, or a
 * date field of the record converted safely.
 */
function time_source_expr(field_id) {
  if (!field_id || field_id === SUBMITTED_AT_FIELD) return "$submitted_at";
  return { $convert: { input: `$data.${field_id}`, to: "date", onError: null, onNull: null } };
}

/**
 * Buckets by fixed-size windows (hour/day/week) anchored on the range's own
 * start - a custom "Aug 1" range buckets as Aug 1, Aug 8, ... - or by
 * calendar month/year for wider spans. Returns [{_id: <bucket key>, value}].
 * Fixed windows key by bucket index (a number), calendar buckets key by a
 * "YYYY-MM"/"YYYY" string.
 */
async function time_rows(widget, bounds, granularity, catalog, split_field) {
  const source = time_source_expr(widget.group_by.field_id);
  const bucket_ms = { hour: 3600000, day: 86400000, week: 604800000 }[granularity];
  const bucket_expr = bucket_ms
    ? { $floor: { $divide: [{ $subtract: [source, bounds.start] }, bucket_ms] } }
    : { $dateToString: { format: granularity === "month" ? "%Y-%m" : "%Y", date: source } };

  const group_id = split_field ? { b: bucket_expr, s: `$data.${split_field}` } : bucket_expr;
  const pipeline = [
    build_match_stage(widget, bounds),
    ...(split_field ? unwind_stages(catalog, [split_field]) : []),
    ...(split_field ? [{ $match: { [`data.${split_field}`]: { $nin: [null, ""] } } }] : []),
    { $group: { _id: group_id, value: metric_accumulator(widget.metric) } },
    { $match: { value: { $ne: null }, _id: { $ne: null } } },
    { $sort: { _id: 1 } },
    { $limit: LIMITS.MAX_TIME_BUCKETS * 4 },
  ];
  return run_pipeline(pipeline);
}

/**
 * The true min/max submitted_at of the matched records - used to derive
 * bounds (and so the bucket size) when the widget has no period at all.
 */
async function time_extent(widget) {
  const pipeline = [
    build_match_stage(widget, null),
    { $group: { _id: null, min: { $min: "$submitted_at" }, max: { $max: "$submitted_at" } } },
  ];
  const rows = await run_pipeline(pipeline);
  if (rows.length === 0 || !rows[0].min || !rows[0].max) return null;
  return { start: new Date(rows[0].min), end: new Date(rows[0].max) };
}

/**
 * Scatter/bubble points: two (or three) numeric fields per record, records
 * that cannot be read as numbers are dropped, capped at MAX_POINTS.
 */
async function point_rows(widget, bounds) {
  const projection = {
    _id: 0,
    x: numeric_expr(widget.x_field_id),
    y: numeric_expr(widget.y_field_id),
  };
  if (widget.size_field_id) projection.size = numeric_expr(widget.size_field_id);
  const pipeline = [
    build_match_stage(widget, bounds),
    { $project: projection },
    { $match: { x: { $ne: null }, y: { $ne: null } } },
    { $limit: LIMITS.MAX_POINTS },
  ];
  return run_pipeline(pipeline);
}

/**
 * KPI value of the current window plus, when the window is bounded, the same
 * aggregation over the equally long window immediately before it - both
 * computed inside one $facet.
 */
async function kpi_rows(widget, bounds) {
  const group_stage = { $group: { _id: null, value: metric_accumulator(widget.metric) } };
  if (!bounds) {
    const rows = await run_pipeline([build_match_stage(widget, null), group_stage]);
    return { current: rows.length ? rows[0].value : 0, previous: null };
  }
  const span = bounds.end.getTime() - bounds.start.getTime();
  const previous_bounds = { start: new Date(bounds.start.getTime() - span - 1), end: new Date(bounds.start.getTime() - 1) };
  const pipeline = [
    build_match_stage(widget, null),
    {
      $facet: {
        current: [{ $match: { submitted_at: { $gte: bounds.start, $lte: bounds.end } } }, group_stage],
        previous: [{ $match: { submitted_at: { $gte: previous_bounds.start, $lte: previous_bounds.end } } }, group_stage],
      },
    },
  ];
  const rows = await run_pipeline(pipeline);
  const facet = rows[0] || { current: [], previous: [] };
  return {
    current: facet.current.length ? facet.current[0].value : 0,
    previous: facet.previous.length ? facet.previous[0].value : 0,
  };
}

/**
 * Treemap rows: the chosen field grouped together with its cascade parent
 * (when it has one), so children nest under their own parent value.
 */
async function tree_rows(widget, bounds, catalog, parent_field_id) {
  const child_field = widget.group_by.field_id;
  const group_id = parent_field_id ? { p: `$data.${parent_field_id}`, c: `$data.${child_field}` } : { c: `$data.${child_field}` };
  const pipeline = [
    build_match_stage(widget, bounds),
    ...unwind_stages(catalog, [child_field]),
    { $match: { [`data.${child_field}`]: { $nin: [null, ""] } } },
    { $group: { _id: group_id, value: metric_accumulator(widget.metric) } },
    { $match: { value: { $ne: null } } },
    { $sort: { value: -1 } },
    { $limit: LIMITS.MAX_CATEGORY_LIMIT * LIMITS.MAX_CATEGORY_LIMIT },
  ];
  return run_pipeline(pipeline);
}

module.exports = {
  category_rows,
  split_rows,
  time_rows,
  time_extent,
  point_rows,
  kpi_rows,
  tree_rows,
};
