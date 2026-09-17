import { SUBMITTED_AT_FIELD } from "./chartCatalog.js";

/**
 * "Over time": the same widget, the same formula, read as the period
 * passes instead of all at once.
 *
 * It is a way of READING a widget, not a chart type. A column chart of
 * "people by district" turned over time becomes "people per day", still
 * counted the same way, still split the same way if it was split - the
 * time line simply takes over the axis the categories had.
 *
 * The clock is one of the form's own date fields, or one of the two the
 * system keeps on every record: when it was submitted, and when it was
 * last changed. How finely the line is sliced follows the period unless
 * it is set by hand - a day reads in hours, a month in days, a decade in
 * years - and the server works that out from the real range, so a custom
 * one gets whatever suits its own length.
 */

/** The two clocks every record carries, whatever the form asks. */
export const UPDATED_AT_FIELD = "updated_at";
export const TIME_SOURCE_IDS = [SUBMITTED_AT_FIELD, UPDATED_AT_FIELD];

/**
 * The looks that can carry a time line: anything that draws one mark per
 * category. A pie, waffle, treemap or map divides ONE whole between its
 * values and has nowhere to put a time line; a KPI is a single number; a
 * scatter has already spent both axes on numbers.
 */
export const OVER_TIME_TYPES = [
  "line",
  "area",
  "bar",
  "column",
  "lollipop",
  "dot_plot",
  "grouped_column",
  "stacked_column",
  "stacked_100",
  "grouped_bar",
  "stacked_bar",
  "stacked_bar_100",
];

export const GRANULARITIES = ["auto", "hour", "day", "week", "month", "year"];

/** The same look with the time line turned on its side, and back. */
const SIDEWAYS = {
  column: "bar",
  grouped_column: "grouped_bar",
  stacked_column: "stacked_bar",
  stacked_100: "stacked_bar_100",
  // A line has no horizontal twin, so asking for time down the side draws
  // it as bars - the only honest way to run a time line vertically.
  line: "bar",
  area: "bar",
  lollipop: "bar",
  dot_plot: "bar",
};
const UPRIGHT = {
  bar: "column",
  grouped_bar: "grouped_column",
  stacked_bar: "stacked_column",
  stacked_bar_100: "stacked_100",
};

export const can_over_time = (widget) => !!widget && OVER_TIME_TYPES.includes(widget.chart_type);

/** A widget's over-time settings, or null when it is read all at once. */
export function over_time_of(widget) {
  const raw = widget && widget.over_time;
  if (!raw || raw.enabled !== true) return null;
  return { enabled: true, field_id: raw.field_id || SUBMITTED_AT_FIELD, granularity: raw.granularity || "auto", axis: raw.axis === "y" ? "y" : "x" };
}

/** Turning it on for the first time: the record's own arrival, sliced to suit the period. */
export const default_over_time = () => ({ enabled: true, field_id: SUBMITTED_AT_FIELD, granularity: "auto", axis: "x" });

/**
 * The chart type actually drawn. Time along the bottom leaves the widget
 * as it is; time down the side swaps it for its horizontal twin, because
 * which axis the time line runs along IS the difference between a column
 * chart and a bar chart.
 */
export function drawn_chart_type(widget) {
  const over_time = over_time_of(widget);
  if (!over_time) return widget.chart_type;
  const map = over_time.axis === "y" ? SIDEWAYS : UPRIGHT;
  return map[widget.chart_type] || widget.chart_type;
}

/** Every clock this form offers, the system's two first. */
export function time_sources(fields, translate) {
  const own = (fields || [])
    .filter((field) => field.type === "date" || field.type === "date_time")
    .map((field) => ({ id: field.id, label: field.label }));
  return [
    { id: SUBMITTED_AT_FIELD, label: translate("DCS_DB_SUBMITTED_AT") },
    { id: UPDATED_AT_FIELD, label: translate("DCS_DB_UPDATED_AT") },
  ].concat(own);
}
