/**
 * The frontend mirror of the backend chart vocabulary
 * (dc_backend/util-dashboard/constants.js, CHART_TYPES): what each type
 * groups on and whether it takes a second (split) choice field; which of
 * them texture their segments by a pattern field; and the single-series
 * look a split chart falls back to when its split falls away. Pure data,
 * so the cascade can cut a derived widget down to what its type carries
 * without pulling in the composers.
 */
export const TYPE_RULES = {
  canvas: { kind: "canvas", split: "none" },
  text: { kind: "text", split: "none" },
  table: { kind: "table", split: "optional" },
  bar: { kind: "category", split: "none" },
  column: { kind: "category", split: "none" },
  lollipop: { kind: "category", split: "none" },
  dot_plot: { kind: "category", split: "none" },
  grouped_column: { kind: "category", split: "required" },
  stacked_column: { kind: "category", split: "required" },
  stacked_100: { kind: "category", split: "required" },
  grouped_bar: { kind: "category", split: "required" },
  stacked_bar: { kind: "category", split: "required" },
  stacked_bar_100: { kind: "category", split: "required" },
  heatmap: { kind: "category", split: "required" },
  pie: { kind: "category", split: "none", slices: 6 },
  donut: { kind: "category", split: "none", slices: 6 },
  waffle: { kind: "category", split: "none", slices: 6 },
  line: { kind: "time", split: "optional" },
  area: { kind: "time", split: "none" },
  scatter: { kind: "point", split: "none" },
  bubble: { kind: "point", split: "none" },
  treemap: { kind: "tree", split: "none" },
  map: { kind: "category", split: "optional" },
  kpi: { kind: "kpi", split: "none" },
};

export const type_rules = (chart_type) => TYPE_RULES[chart_type] || { kind: "category", split: "none" };

/** The split charts that can texture each segment by a third choice field (PATTERN_CHART_TYPES on the server). */
export const PATTERN_CHART_TYPES = ["grouped_column", "stacked_column", "stacked_100", "grouped_bar", "stacked_bar", "stacked_bar_100"];

/** The single-series look a split chart becomes when it has no split left to draw. */
export const SINGLE_OF = {
  grouped_column: "column",
  stacked_column: "column",
  stacked_100: "column",
  grouped_bar: "bar",
  stacked_bar: "bar",
  stacked_bar_100: "bar",
  heatmap: "column",
};
