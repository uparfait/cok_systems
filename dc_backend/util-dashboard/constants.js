/**
 * Shared vocabulary of the dashboard feature: every chart type the builder
 * offers, which data "kind" feeds it, and the hard limits a saved dashboard
 * must respect. The frontend chart catalog mirrors these same ids.
 */

const CHART_KINDS = {
  CATEGORY: "category",
  TIME: "time",
  POINT: "point",
  TREE: "tree",
  KPI: "kpi",
  // The records themselves, each at the place it was collected.
  HEAT: "heat",
  // A canvas holds no data of its own: it is a place other widgets sit in.
  CANVAS: "canvas",
  // A text block is words on the board - a title band, an observation, a
  // recommendation. It reads nothing either.
  TEXT: "text",
  // A table: the records themselves, a page at a time, or one row per value
  // of a field with a column per measure - and totals.
  TABLE: "table",
};

// chart_type -> the data kind its pipeline produces, whether a split
// (second categorical field) is required/allowed, and the slice cap for
// circular/part-to-whole charts that stop being readable past a few slices.
const CHART_TYPES = {
  /**
   * A CANVAS is a widget that holds other widgets. It reads nothing and
   * asks the database for nothing - what it carries is a layout. Widgets
   * name it in their parent_id and lay themselves out inside it with their
   * own box (see sanitize_box): along a row, wrapping onto the next line or
   * not, or stacked in a column, at whatever width and height they were
   * given in pixels or in percent of the canvas.
   */
  canvas: { kind: CHART_KINDS.CANVAS, split: "none" },
  text: { kind: CHART_KINDS.TEXT, split: "none" },
  // A summary table may take a split field: its values become the columns.
  table: { kind: CHART_KINDS.TABLE, split: "optional" },
  bar: { kind: CHART_KINDS.CATEGORY, split: "none" },
  column: { kind: CHART_KINDS.CATEGORY, split: "none" },
  lollipop: { kind: CHART_KINDS.CATEGORY, split: "none" },
  dot_plot: { kind: CHART_KINDS.CATEGORY, split: "none" },
  grouped_column: { kind: CHART_KINDS.CATEGORY, split: "required" },
  stacked_column: { kind: CHART_KINDS.CATEGORY, split: "required" },
  stacked_100: { kind: CHART_KINDS.CATEGORY, split: "required" },
  grouped_bar: { kind: CHART_KINDS.CATEGORY, split: "required" },
  stacked_bar: { kind: CHART_KINDS.CATEGORY, split: "required" },
  stacked_bar_100: { kind: CHART_KINDS.CATEGORY, split: "required" },
  heatmap: { kind: CHART_KINDS.CATEGORY, split: "required" },
  pie: { kind: CHART_KINDS.CATEGORY, split: "none", max_slices: 6 },
  donut: { kind: CHART_KINDS.CATEGORY, split: "none", max_slices: 6 },
  waffle: { kind: CHART_KINDS.CATEGORY, split: "none", max_slices: 6 },
  line: { kind: CHART_KINDS.TIME, split: "optional" },
  area: { kind: CHART_KINDS.TIME, split: "none" },
  scatter: { kind: CHART_KINDS.POINT, split: "none" },
  bubble: { kind: CHART_KINDS.POINT, split: "none" },
  treemap: { kind: CHART_KINDS.TREE, split: "none" },
  // A map colours administrative boundaries instead of bars: the same
  // category data, grouped by a location field of the form.
  map: { kind: CHART_KINDS.CATEGORY, split: "optional" },
  kpi: { kind: CHART_KINDS.KPI, split: "none" },
};

const AGGREGATIONS = [
  "count",
  "count_distinct",
  "sum",
  "avg",
  "median",
  "min",
  "max",
  "stddev",
  "cumulative_sum",
  "moving_average",
  // How many times each value of a field occurs: one row per value, with
  // the value (or chosen display fields) as its label - see
  // pipelines.occurrence_rows.
  "occurrences",
];

// The threshold a "occurrences" widget may apply to each value's count,
// and whether it shows only the values that meet it or every value.
const OCCURRENCE_OPERATORS = ["gt", "gte", "eq", "lte", "lt"];
const OCCURRENCE_SCOPES = ["matching", "all"];

// Aggregations only a KPI card can compute - they have no meaningful (or no
// efficient) per-category grouped form, so category/split/time/tree widgets
// refuse them.
const KPI_ONLY_AGGREGATIONS = ["median", "cumulative_sum", "moving_average"];

// Aggregations that read the field as a number: answers that cannot be
// converted (free text typed into what the formula needs as a number) are
// SKIPPED, counted, and reported back so the card can flag them.
const NUMERIC_AGGREGATIONS = ["sum", "avg", "median", "min", "max", "stddev", "cumulative_sum", "moving_average"];

// "empty" and "not_empty" read whether the field was answered at all and
// take no value: they are how a board counts records missing a photo, a
// cost or a position.
const FILTER_OPERATORS = ["eq", "ne", "contains", "gt", "gte", "lt", "lte", "empty", "not_empty"];
const VALUELESS_OPERATORS = ["empty", "not_empty"];

const PERIOD_PRESETS = ["all", "today", "this_week", "this_month", "last_month", "this_year", "custom"];

const SORT_OPTIONS = ["value_desc", "value_asc", "label_asc"];

// The administrative levels a map widget can draw, top down.
/** How a widget joins the flow of the canvas it sits in. */
const BOX_FLOWS = ["row", "row_break", "column"];
// A canvas arranges what is in it along rows, down a column, or not at all:
// FREE places every widget exactly where it was dragged.
const CANVAS_FLOWS = ["row", "column", "free"];
// How a whole BOARD is arranged: the responsive grid it has always used,
// or STUDIO, where every widget is placed and sized by hand.
const BOARD_MODES = ["grid", "studio"];
// The width a studio board was arranged at. Everything on it is placed in
// pixels against this, so a narrower screen scales the whole board down by
// the ratio between the two rather than reflowing and losing the design.
const BOARD_WIDTH = { least: 320, most: 4000, usual: 1280 };
/** What a length is measured in. */
const BOX_UNITS = ["px", "%"];
// A canvas is sized one way or the other, never both: pinned to a width
// and a height, or held between a least and a most.
const BOX_SIZE_MODES = ["fixed", "range"];
// And a canvas has one more answer than a widget's box does: THE REST,
// whatever room the things beside it have not taken. It carries no number.
const CANVAS_UNITS = ["px", "%", "rest"];
/** How deep canvases may nest before a board becomes unreadable. */
const MAX_CANVAS_DEPTH = 3;

const MAP_LEVELS = ["province", "district", "sector", "cell", "village"];

/**
 * A TABLE is one of two things. RECORDS: the submissions themselves, the
 * chosen fields as columns, a page at a time - never fewer than ten rows a
 * page and never more than a hundred. SUMMARY: one row per value of the
 * group field, and a column per value of the split field OR per measure
 * the author defined (each a formula on a field, under its own filters),
 * with a total row and a total column when asked for.
 */
const TABLE_MODES = ["records", "summary"];
const TABLE_LIMITS = { MIN_PAGE_SIZE: 10, MAX_PAGE_SIZE: 100, DEFAULT_PAGE_SIZE: 10, MAX_FIELDS: 30, MAX_COLUMNS: 30, MAX_SUMMARY_ROWS: 50, MAX_COLUMN_LABEL: 120 };
const SORT_DIRECTIONS = ["asc", "desc"];

/**
 * A TEXT block: a heading and a body, aligned and sized, with one accent
 * colour for the words the author wants to stand out (==like this==).
 */
const TEXT_ALIGNS = ["left", "center", "right"];
const TEXT_SIZES = ["sm", "md", "lg"];
const TEXT_LIMITS = { MAX_HEADING: 200, MAX_BODY: 4000 };

/**
 * How many board filter fields one widget may refuse to follow. A widget
 * pinned on the district field keeps its district breakdown while the rest
 * of the board drills into the picked district.
 */
const MAX_PINNED_FIELDS = 10;

const WIDGET_SIZES = ["small", "medium", "large", "full"];

const TIME_GRANULARITIES = ["auto", "hour", "day", "week", "month", "year"];

// The pseudo field every form always has: when a record was submitted.
const SUBMITTED_AT_FIELD = "submitted_at";
const UPDATED_AT_FIELD = "updated_at";

/**
 * "Over time" turns a widget that counts things into one that counts them
 * AS TIME PASSES: the same formula, applied to each slice of the period.
 * The clock it reads is one of the form's own date fields, or one of the
 * two the system keeps on every record - when it was submitted, and when
 * it was last changed.
 */
const TIME_SOURCE_FIELDS = [SUBMITTED_AT_FIELD, UPDATED_AT_FIELD];

/**
 * The looks a widget can keep while being drawn over time. A time series
 * is a run of values along one axis, so anything that draws one mark per
 * category can carry it - bars, columns, lines and areas, grouped and
 * stacked. A pie, a waffle, a treemap and a map divide ONE whole between
 * values and have nowhere to put a time line; a KPI is a single number;
 * a scatter already spends both its axes on numbers.
 */
const OVER_TIME_TYPES = [
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

/** Which way the time line runs: along the bottom, or down the side. */
const OVER_TIME_AXES = ["x", "y"];

const LIMITS = {
  // The automatic generator builds the full pairwise comparison matrix of
  // the form's choice fields, so a dashboard is deliberately large - the
  // user trims it by removing the widgets they do not want.
  MAX_WIDGETS: 150,
  MAX_TITLE_LENGTH: 120,
  MAX_FILTERS: 10,
  MAX_CATEGORY_LIMIT: 50,
  // A map is not a bar chart: every place it has an answer for is drawn.
  MAX_MAP_CATEGORIES: 1500,
  MAX_DISPLAY_FIELDS: 5,
  DEFAULT_CATEGORY_LIMIT: 12,
  MAX_POINTS: 500,
  // A heat map is drawn from the records themselves, not from groups of
  // them, so it carries far more - but never a whole database.
  MAX_HEAT_POINTS: 8000,
  MAX_TIME_BUCKETS: 400,
};

module.exports = {
  CHART_KINDS,
  CHART_TYPES,
  AGGREGATIONS,
  OCCURRENCE_OPERATORS,
  OCCURRENCE_SCOPES,
  KPI_ONLY_AGGREGATIONS,
  NUMERIC_AGGREGATIONS,
  FILTER_OPERATORS,
  VALUELESS_OPERATORS,
  PERIOD_PRESETS,
  SORT_OPTIONS,
  WIDGET_SIZES,
  MAP_LEVELS,
  TABLE_MODES,
  TABLE_LIMITS,
  SORT_DIRECTIONS,
  TEXT_ALIGNS,
  TEXT_SIZES,
  TEXT_LIMITS,
  MAX_PINNED_FIELDS,
  TIME_GRANULARITIES,
  SUBMITTED_AT_FIELD,
  UPDATED_AT_FIELD,
  BOX_FLOWS,
  CANVAS_FLOWS,
  BOARD_MODES,
  BOARD_WIDTH,
  BOX_UNITS,
  BOX_SIZE_MODES,
  CANVAS_UNITS,
  MAX_CANVAS_DEPTH,
  TIME_SOURCE_FIELDS,
  OVER_TIME_TYPES,
  OVER_TIME_AXES,
  LIMITS,
};
