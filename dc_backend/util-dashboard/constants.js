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
};

// chart_type -> the data kind its pipeline produces, whether a split
// (second categorical field) is required/allowed, and the slice cap for
// circular/part-to-whole charts that stop being readable past a few slices.
const CHART_TYPES = {
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

const FILTER_OPERATORS = ["eq", "ne", "contains", "gt", "gte", "lt", "lte"];

const PERIOD_PRESETS = ["all", "today", "this_week", "this_month", "last_month", "this_year", "custom"];

const SORT_OPTIONS = ["value_desc", "value_asc", "label_asc"];

// The administrative levels a map widget can draw, top down.
const MAP_LEVELS = ["province", "district", "sector", "cell", "village"];

const WIDGET_SIZES = ["small", "medium", "large", "full"];

const TIME_GRANULARITIES = ["auto", "hour", "day", "week", "month", "year"];

// The pseudo field every form always has: when a record was submitted.
const SUBMITTED_AT_FIELD = "submitted_at";

const LIMITS = {
  // The automatic generator builds the full pairwise comparison matrix of
  // the form's choice fields, so a dashboard is deliberately large - the
  // user trims it by removing the widgets they do not want.
  MAX_WIDGETS: 150,
  MAX_TITLE_LENGTH: 120,
  MAX_FILTERS: 10,
  MAX_CATEGORY_LIMIT: 50,
  MAX_DISPLAY_FIELDS: 5,
  DEFAULT_CATEGORY_LIMIT: 12,
  MAX_POINTS: 500,
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
  PERIOD_PRESETS,
  SORT_OPTIONS,
  WIDGET_SIZES,
  MAP_LEVELS,
  TIME_GRANULARITIES,
  SUBMITTED_AT_FIELD,
  LIMITS,
};
