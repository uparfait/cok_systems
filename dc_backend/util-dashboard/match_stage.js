const { resolve_period_bounds } = require("../utilities/period_bounds.js");
const { tracking_stages } = require("./tracking_stage.js");
const { STAGE_AT, time_field, time_expr, is_staged, stage_prefilter, stage_rows_stages } = require("../utilities/tracking_window.js");

/**
 * Builds the base $match of every widget pipeline: the form's submissions
 * (generated test data INCLUDED - the dashboard charts everything the form
 * holds, exactly like the submissions-over-time chart) inside the effective
 * time window, narrowed by the widget's own field filters. Everything here
 * stays a plain Mongo query - the database does all the filtering.
 */

function escape_regex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A submitted value can be stored as a string or a number depending on the
 * field - equality filters match both representations.
 */
function value_candidates(value) {
  const candidates = [value];
  const as_string = String(value);
  if (!candidates.includes(as_string)) candidates.push(as_string);
  const as_number = Number(value);
  if (Number.isFinite(as_number) && !candidates.includes(as_number)) candidates.push(as_number);
  return candidates;
}

function numeric_expr(field_id) {
  return { $convert: { input: `$data.${field_id}`, to: "double", onError: null, onNull: null } };
}

/**
 * One widget filter -> one Mongo condition. Unknown operators were already
 * rejected by validation, so this only ever sees the supported set.
 */
// An unanswered field is missing, null, blank or an empty list.
const EMPTY_VALUES = [null, "", []];

function filter_condition(filter) {
  const path = `data.${filter.field_id}`;
  if (filter.operator === "empty") return { $or: [{ [path]: { $exists: false } }, { [path]: { $in: EMPTY_VALUES } }] };
  if (filter.operator === "not_empty") return { [path]: { $exists: true, $nin: EMPTY_VALUES } };
  if (filter.operator === "eq") return { [path]: { $in: value_candidates(filter.value) } };
  if (filter.operator === "ne") return { [path]: { $nin: value_candidates(filter.value) } };
  if (filter.operator === "contains") {
    return { [path]: { $regex: escape_regex(filter.value), $options: "i" } };
  }
  const comparison = { gt: "$gt", gte: "$gte", lt: "$lt", lte: "$lte" }[filter.operator];
  return { $expr: { [comparison]: [numeric_expr(filter.field_id), Number(filter.value)] } };
}

/**
 * The effective [start, end] window of a widget: the dashboard-level
 * override wins over the widget's own period - unless the widget LOCKED
 * its own (period.locked), in which case it always reads the window it
 * was given and the board's date filter passes it by. "all" (or nothing)
 * means no bound. Returns null for unbounded, undefined never escapes (an
 * invalid custom range falls back to unbounded).
 */
function is_period_locked(widget) {
  return !!(widget && widget.period && widget.period.locked === true);
}

function effective_bounds(widget, period_override) {
  const own = (widget && widget.period) || null;
  const period = is_period_locked(widget) ? own : period_override || own;
  if (!period || !period.preset || period.preset === "all") return null;
  const bounds = resolve_period_bounds(period.preset, period.from, period.to);
  return bounds || null;
}

/**
 * The base $match for one widget. Version is intentionally not filtered:
 * a dashboard reads the whole form group's history, whichever version each
 * record was collected with.
 *
 * Only what an index can serve goes in here. The widget's own field
 * filters do NOT: on a tracked form they have to be judged against the
 * value of the stage being counted, which does not exist yet at this
 * point in the pipeline (see filter_stages).
 */
function build_match_stage(widget, bounds) {
  return { $match: Object.assign({ form_group_id: widget.form_group_id }, stage_prefilter(bounds, widget && widget.tracking)) };
}

/**
 * The widget's own field filters, as a $match that runs AFTER the stages
 * are built. A filter like "status is out" then keeps the stage where the
 * car left and drops the stage where it arrived, instead of judging both
 * by whatever the record happens to say today.
 */
function filter_stages(widget) {
  const conditions = ((widget && widget.filters) || []).map((filter) => filter_condition(filter));
  if (conditions.length === 0) return [];
  return [{ $match: conditions.length === 1 ? conditions[0] : { $and: conditions } }];
}

/**
 * The opening of every widget pipeline: the indexed $match, the expansion
 * of each record into one row per STAGE with that stage's own values (see
 * utilities/tracking_window.js), then the widget's filters over those
 * values. A car recorded "in" at 12:00 and labelled "out" at 13:00 reaches
 * every widget as two rows, which is what lets one KPI card count the
 * arrivals and another count the departures over the very same hours.
 *
 * match_bounds is the window; value_bounds (defaulting to it) exists for
 * the KPI cards, which expand every stage here and then window each facet
 * separately.
 */
function base_stages(widget, match_bounds, value_bounds) {
  const bounds = value_bounds === undefined ? match_bounds : value_bounds;
  return [
    build_match_stage(widget, match_bounds),
    ...stage_rows_stages(widget && widget.tracking, bounds),
    ...filter_stages(widget),
  ];
}

module.exports = {
  build_match_stage,
  filter_stages,
  base_stages,
  tracking_stages,
  effective_bounds,
  is_period_locked,
  numeric_expr,
  value_candidates,
};
