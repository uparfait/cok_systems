const { get_db } = require("../db_connection/db.js");
const { build_match_stage, numeric_expr } = require("./match_stage.js");
const { is_multi_value } = require("./field_catalog.js");
const { NUMERIC_AGGREGATIONS } = require("./constants.js");

const SUBMISSIONS_COLLECTION = "dcs_submissions";
const MOVING_WINDOW_DAYS = 7;
const DAY_MS = 86400000;

/**
 * The KPI card's whole formula catalog computed natively in MongoDB:
 * count, count distinct, sum, average, median, minimum, maximum, standard
 * deviation, cumulative sum (the running total from the very first record
 * up to the end of the selected range) and moving average (the average per
 * day over the last seven days of the range).
 *
 * On a NUMBER-bearing field the numeric formulas aggregate the answers
 * themselves, SKIPPING every answer that cannot be read as a number (free
 * text typed into a number field) and reporting how many were skipped;
 * kpi_skipped_rows lists those records in full. On a CHOICE field (radio,
 * select, cascading, select group, ranking) the same formulas aggregate the
 * RECORD COUNTS instead - a "moving average of District - Ruhango" is the
 * average submissions per day for Ruhango, a sum is its total records, and
 * average/median/min/max/deviation describe its submissions PER DAY -
 * because converting "Ruhango" to a number can only ever skip everything.
 * Likert scales stay numeric: their answers are real ratings.
 *
 * The previous-period comparison is computed ONLY for plain count.
 */

// Choice types whose values are names, not numbers - numeric formulas on
// them aggregate record counts (likert is NOT here: ratings are numbers).
const COUNT_BASED_TYPES = ["single_select", "multi_select", "cascading_select", "select_group", "ranking"];

function is_count_based(aggregation, field_id, catalog) {
  if (!NUMERIC_AGGREGATIONS.includes(aggregation)) return false;
  const field = catalog && catalog.fields_by_id ? catalog.fields_by_id.get(field_id) : null;
  return !!field && COUNT_BASED_TYPES.includes(field.type);
}

function run_pipeline(pipeline) {
  return get_db().collection(SUBMISSIONS_COLLECTION).aggregate(pipeline).toArray();
}

function answered_match(field_id) {
  return { $match: { [`data.${field_id}`]: { $nin: [null, ""] } } };
}

function window_match(window) {
  if (!window) return [];
  const range = {};
  if (window.start) range.$gte = window.start;
  if (window.end) range.$lte = window.end;
  return Object.keys(range).length > 0 ? [{ $match: { submitted_at: range } }] : [];
}

/**
 * The current/previous/skipped time windows of one KPI. The classic
 * formulas compare the selected range against the equally long range right
 * before it; the cumulative sum runs from the beginning of time up to the
 * range's end (previous: up to the range's start); the moving average
 * always looks at the last seven days of the range (previous: the seven
 * days before those). Skips are always counted inside the current window.
 */
function kpi_windows(aggregation, bounds) {
  const now = new Date();
  if (aggregation === "cumulative_sum") {
    const end = bounds ? bounds.end : now;
    const current = { start: null, end };
    const previous = bounds ? { start: null, end: new Date(bounds.start.getTime() - 1) } : null;
    return { current, previous, skipped: current };
  }
  if (aggregation === "moving_average") {
    const end = bounds ? bounds.end : now;
    const window_ms = MOVING_WINDOW_DAYS * DAY_MS;
    return {
      current: { start: new Date(end.getTime() - window_ms), end },
      previous: { start: new Date(end.getTime() - 2 * window_ms), end: new Date(end.getTime() - window_ms - 1) },
      skipped: { start: new Date(end.getTime() - window_ms), end },
    };
  }
  if (!bounds) return { current: null, previous: null, skipped: null };
  const span = bounds.end.getTime() - bounds.start.getTime();
  return {
    current: { start: bounds.start, end: bounds.end },
    previous: { start: new Date(bounds.start.getTime() - span - 1), end: new Date(bounds.start.getTime() - 1) },
    skipped: { start: bounds.start, end: bounds.end },
  };
}

/**
 * The stages computing one window's value, appended after the base match.
 * They produce [{value}] - except the median, which produces the sorted
 * values ([{values: [...]}]) picked apart in facet_value: the middle value
 * cannot be expressed as a plain accumulator on every MongoDB version.
 */
function value_stages(aggregation, field_id, window, catalog) {
  const stages = window_match(window);
  if (aggregation === "count") {
    if (field_id) stages.push(answered_match(field_id));
    stages.push({ $count: "value" });
    return stages;
  }
  if (is_count_based(aggregation, field_id, catalog)) {
    stages.push(answered_match(field_id));
    // Additive formulas over a choice field total its records; the window
    // logic (cumulative, last seven days) does the rest.
    if (["sum", "cumulative_sum", "moving_average"].includes(aggregation)) {
      stages.push({ $count: "value" });
      return stages;
    }
    // Statistical formulas describe the field's submissions PER DAY.
    stages.push({ $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$submitted_at" } }, n: { $sum: 1 } } });
    if (aggregation === "median") {
      stages.push({ $sort: { n: 1 } }, { $group: { _id: null, values: { $push: "$n" } } });
      return stages;
    }
    const daily_operator = { avg: "$avg", min: "$min", max: "$max", stddev: "$stdDevPop" }[aggregation];
    stages.push({ $group: { _id: null, value: { [daily_operator]: "$n" } } });
    return stages;
  }
  if (aggregation === "count_distinct") {
    stages.push(answered_match(field_id));
    if (is_multi_value(catalog, field_id)) {
      stages.push({ $unwind: { path: `$data.${field_id}`, preserveNullAndEmptyArrays: false } });
    }
    stages.push(
      { $group: { _id: null, value: { $addToSet: `$data.${field_id}` } } },
      { $set: { value: { $size: "$value" } } },
    );
    return stages;
  }
  stages.push(answered_match(field_id), { $project: { n: numeric_expr(field_id) } }, { $match: { n: { $ne: null } } });
  if (aggregation === "median") {
    stages.push({ $sort: { n: 1 } }, { $group: { _id: null, values: { $push: "$n" } } });
    return stages;
  }
  const operator = {
    sum: "$sum",
    avg: "$avg",
    min: "$min",
    max: "$max",
    stddev: "$stdDevPop",
    cumulative_sum: "$sum",
    moving_average: "$sum",
  }[aggregation];
  stages.push({ $group: { _id: null, value: { [operator]: "$n" } } });
  return stages;
}

function median_of(sorted_values) {
  if (!sorted_values || sorted_values.length === 0) return 0;
  const middle = Math.floor(sorted_values.length / 2);
  if (sorted_values.length % 2 === 1) return sorted_values[middle];
  return (sorted_values[middle - 1] + sorted_values[middle]) / 2;
}

function facet_value(aggregation, rows) {
  if (!rows || rows.length === 0) return 0;
  if (aggregation === "median") return median_of(rows[0].values);
  return rows[0].value || 0;
}

/**
 * The complete KPI result of one widget: { current, previous, skipped }.
 * Everything - current window, comparison window and the skipped-answer
 * count - is computed inside ONE $facet round trip.
 */
async function kpi_metric_result(widget, bounds, catalog) {
  const aggregation = (widget.metric && widget.metric.aggregation) || "count";
  const field_id = widget.metric && widget.metric.field_id;
  const windows = kpi_windows(aggregation, bounds);
  // Only plain count carries the previous-period comparison.
  if (aggregation !== "count") windows.previous = null;
  const numeric = NUMERIC_AGGREGATIONS.includes(aggregation) && !is_count_based(aggregation, field_id, catalog);

  const facets = { current: value_stages(aggregation, field_id, windows.current, catalog) };
  if (windows.previous) facets.previous = value_stages(aggregation, field_id, windows.previous, catalog);
  if (numeric) {
    facets.skipped = [
      ...window_match(windows.skipped),
      answered_match(field_id),
      { $project: { n: numeric_expr(field_id) } },
      { $match: { n: null } },
      { $count: "value" },
    ];
  }

  const rows = await run_pipeline([build_match_stage(widget, null), { $facet: facets }]);
  const facet = rows[0] || {};
  let current = facet_value(aggregation, facet.current);
  let previous = windows.previous ? facet_value(aggregation, facet.previous) : null;
  if (aggregation === "moving_average") {
    // The rolling value: the window's total spread over its days, so empty
    // days pull the average down exactly like a plotted moving average.
    current = current / MOVING_WINDOW_DAYS;
    previous = previous === null ? null : previous / MOVING_WINDOW_DAYS;
  }
  const skipped = numeric && facet.skipped && facet.skipped.length > 0 ? facet.skipped[0].value || 0 : 0;
  return { current, previous, skipped };
}

/**
 * The full detail of the answers a numeric KPI skipped inside its current
 * window: when each was submitted and exactly what was entered, newest
 * first, capped - plus the true total. A non-numeric formula skips nothing.
 */
async function kpi_skipped_rows(widget, bounds, limit, catalog) {
  const aggregation = (widget.metric && widget.metric.aggregation) || "count";
  const field_id = widget.metric && widget.metric.field_id;
  if (!NUMERIC_AGGREGATIONS.includes(aggregation) || !field_id || is_count_based(aggregation, field_id, catalog)) {
    return { total: 0, rows: [] };
  }
  const windows = kpi_windows(aggregation, bounds);
  const pipeline = [
    build_match_stage(widget, null),
    ...window_match(windows.skipped),
    answered_match(field_id),
    { $project: { submitted_at: 1, raw: `$data.${field_id}`, n: numeric_expr(field_id) } },
    { $match: { n: null } },
    {
      $facet: {
        total: [{ $count: "value" }],
        rows: [{ $sort: { submitted_at: -1 } }, { $limit: limit }, { $project: { _id: 0, submitted_at: 1, raw: 1 } }],
      },
    },
  ];
  const result = await run_pipeline(pipeline);
  const facet = result[0] || { total: [], rows: [] };
  return {
    total: facet.total.length > 0 ? facet.total[0].value || 0 : 0,
    rows: facet.rows || [],
  };
}

module.exports = {
  kpi_metric_result,
  kpi_skipped_rows,
};
