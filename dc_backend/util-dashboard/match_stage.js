const { resolve_period_bounds } = require("../utilities/period_bounds.js");

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
function filter_condition(filter) {
  const path = `data.${filter.field_id}`;
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
 * override wins over the widget's own period; "all" (or nothing) means no
 * bound. Returns null for unbounded, undefined never escapes (an invalid
 * custom range falls back to unbounded).
 */
function effective_bounds(widget, period_override) {
  const period = period_override || widget.period || null;
  if (!period || !period.preset || period.preset === "all") return null;
  const bounds = resolve_period_bounds(period.preset, period.from, period.to);
  return bounds || null;
}

/**
 * The base $match for one widget. Version is intentionally not filtered:
 * a dashboard reads the whole form group's history, whichever version each
 * record was collected with.
 */
function build_match_stage(widget, bounds) {
  const match = {
    form_group_id: widget.form_group_id,
  };
  if (bounds) {
    match.submitted_at = { $gte: bounds.start, $lte: bounds.end };
  }
  const conditions = (widget.filters || []).map((filter) => filter_condition(filter));
  if (conditions.length === 1) Object.assign(match, conditions[0]);
  if (conditions.length > 1) match.$and = conditions;
  return { $match: match };
}

module.exports = {
  build_match_stage,
  effective_bounds,
  numeric_expr,
};
