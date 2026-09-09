/**
 * The frontend mirror of the backend chart vocabulary: every chart type the
 * builder offers, grouped by family, with its data requirements and a
 * "when to use" hint key. The wizard only ever offers fields that fit the
 * picked chart, so a saved widget can always be rendered.
 */

export const CHART_FAMILIES = [
  { key: "comparison", labelKey: "DCS_DB_FAMILY_COMPARISON" },
  { key: "time", labelKey: "DCS_DB_FAMILY_TIME" },
  { key: "part", labelKey: "DCS_DB_FAMILY_PART" },
  { key: "correlation", labelKey: "DCS_DB_FAMILY_CORRELATION" },
  { key: "kpi", labelKey: "DCS_DB_FAMILY_KPI" },
];

// kind: category | time | point | tree | kpi (matches the backend).
// split: none | optional | required. max_slices caps circular charts.
export const CHART_CATALOG = [
  { type: "bar", family: "comparison", kind: "category", split: "none", labelKey: "DCS_DB_CHART_BAR", hintKey: "DCS_DB_HINT_BAR" },
  { type: "column", family: "comparison", kind: "category", split: "none", labelKey: "DCS_DB_CHART_COLUMN", hintKey: "DCS_DB_HINT_COLUMN" },
  { type: "grouped_column", family: "comparison", kind: "category", split: "required", labelKey: "DCS_DB_CHART_GROUPED", hintKey: "DCS_DB_HINT_GROUPED" },
  { type: "lollipop", family: "comparison", kind: "category", split: "none", labelKey: "DCS_DB_CHART_LOLLIPOP", hintKey: "DCS_DB_HINT_LOLLIPOP" },
  { type: "dot_plot", family: "comparison", kind: "category", split: "none", labelKey: "DCS_DB_CHART_DOT", hintKey: "DCS_DB_HINT_DOT" },
  { type: "line", family: "time", kind: "time", split: "optional", labelKey: "DCS_DB_CHART_LINE", hintKey: "DCS_DB_HINT_LINE" },
  { type: "area", family: "time", kind: "time", split: "none", labelKey: "DCS_DB_CHART_AREA", hintKey: "DCS_DB_HINT_AREA" },
  { type: "stacked_column", family: "part", kind: "category", split: "required", labelKey: "DCS_DB_CHART_STACKED", hintKey: "DCS_DB_HINT_STACKED" },
  { type: "stacked_100", family: "part", kind: "category", split: "required", labelKey: "DCS_DB_CHART_STACKED_100", hintKey: "DCS_DB_HINT_STACKED_100" },
  { type: "pie", family: "part", kind: "category", split: "none", max_slices: 6, labelKey: "DCS_DB_CHART_PIE", hintKey: "DCS_DB_HINT_PIE" },
  { type: "donut", family: "part", kind: "category", split: "none", max_slices: 6, labelKey: "DCS_DB_CHART_DONUT", hintKey: "DCS_DB_HINT_DONUT" },
  { type: "waffle", family: "part", kind: "category", split: "none", max_slices: 6, labelKey: "DCS_DB_CHART_WAFFLE", hintKey: "DCS_DB_HINT_WAFFLE" },
  { type: "treemap", family: "part", kind: "tree", split: "none", labelKey: "DCS_DB_CHART_TREEMAP", hintKey: "DCS_DB_HINT_TREEMAP" },
  { type: "scatter", family: "correlation", kind: "point", split: "none", labelKey: "DCS_DB_CHART_SCATTER", hintKey: "DCS_DB_HINT_SCATTER" },
  { type: "bubble", family: "correlation", kind: "point", split: "none", labelKey: "DCS_DB_CHART_BUBBLE", hintKey: "DCS_DB_HINT_BUBBLE" },
  { type: "heatmap", family: "correlation", kind: "category", split: "required", labelKey: "DCS_DB_CHART_HEATMAP", hintKey: "DCS_DB_HINT_HEATMAP" },
  { type: "kpi", family: "kpi", kind: "kpi", split: "none", labelKey: "DCS_DB_CHART_KPI", hintKey: "DCS_DB_HINT_KPI" },
];

export const chart_definition = (type) => CHART_CATALOG.find((entry) => entry.type === type) || null;

// Field classification, mirroring the backend catalog exactly.
const CATEGORICAL_TYPES = ["single_select", "multi_select", "cascading_select", "select_group", "likert_scale"];
const NUMERIC_TYPES = ["number"];
const DATE_TYPES = ["date", "date_time"];

export const SUBMITTED_AT_FIELD = "submitted_at";

export function flatten_schema_fields(fields, accumulator) {
  const flat = accumulator || [];
  (fields || []).forEach((field) => {
    if (!field) return;
    flat.push(field);
    if (Array.isArray(field.children)) flatten_schema_fields(field.children, flat);
  });
  return flat;
}

export function field_label_text(field) {
  if (field && field.label) return field.label.en || field.label.kn || field.label.fr || field.id;
  return field ? field.id : "";
}

/**
 * The chartable fields of one form, grouped by role. The submitted_at
 * pseudo field is appended to the date group by the wizard itself (it needs
 * a translated label).
 */
export function classify_fields(schema) {
  const flat = flatten_schema_fields((schema && schema.fields) || []);
  return {
    all: flat.filter((field) => field && field.id),
    categorical: flat.filter((field) => CATEGORICAL_TYPES.includes(field.type)),
    numeric: flat.filter((field) => NUMERIC_TYPES.includes(field.type)),
    dates: flat.filter((field) => DATE_TYPES.includes(field.type)),
  };
}

export const AGGREGATION_OPTIONS = [
  { id: "count", labelKey: "DCS_DB_AGG_COUNT" },
  { id: "sum", labelKey: "DCS_DB_AGG_SUM" },
  { id: "avg", labelKey: "DCS_DB_AGG_AVG" },
  { id: "min", labelKey: "DCS_DB_AGG_MIN" },
  { id: "max", labelKey: "DCS_DB_AGG_MAX" },
];

export const FILTER_OPERATOR_OPTIONS = [
  { id: "eq", labelKey: "DCS_DB_OP_EQ" },
  { id: "ne", labelKey: "DCS_DB_OP_NE" },
  { id: "contains", labelKey: "DCS_DB_OP_CONTAINS" },
  { id: "gt", labelKey: "DCS_DB_OP_GT" },
  { id: "gte", labelKey: "DCS_DB_OP_GTE" },
  { id: "lt", labelKey: "DCS_DB_OP_LT" },
  { id: "lte", labelKey: "DCS_DB_OP_LTE" },
];

export const GRANULARITY_OPTIONS = [
  { id: "auto", labelKey: "DCS_DB_GRAN_AUTO" },
  { id: "hour", labelKey: "DCS_DB_GRAN_HOUR" },
  { id: "day", labelKey: "DCS_DB_GRAN_DAY" },
  { id: "week", labelKey: "DCS_DB_GRAN_WEEK" },
  { id: "month", labelKey: "DCS_DB_GRAN_MONTH" },
  { id: "year", labelKey: "DCS_DB_GRAN_YEAR" },
];

export const SORT_OPTIONS_LIST = [
  { id: "value_desc", labelKey: "DCS_DB_SORT_VALUE_DESC" },
  { id: "value_asc", labelKey: "DCS_DB_SORT_VALUE_ASC" },
  { id: "label_asc", labelKey: "DCS_DB_SORT_LABEL_ASC" },
];

export const SIZE_OPTIONS = [
  { id: "small", labelKey: "DCS_DB_SIZE_SMALL" },
  { id: "medium", labelKey: "DCS_DB_SIZE_MEDIUM" },
  { id: "large", labelKey: "DCS_DB_SIZE_LARGE" },
  { id: "full", labelKey: "DCS_DB_SIZE_FULL" },
];

export const PERIOD_PRESET_OPTIONS = [
  { id: "all", labelKey: "DCS_STATS_PERIOD_ALL" },
  { id: "today", labelKey: "DCS_STATS_PERIOD_TODAY" },
  { id: "this_week", labelKey: "DCS_STATS_PERIOD_THIS_WEEK" },
  { id: "this_month", labelKey: "DCS_STATS_PERIOD_THIS_MONTH" },
  { id: "last_month", labelKey: "DCS_STATS_PERIOD_LAST_MONTH" },
  { id: "this_year", labelKey: "DCS_STATS_PERIOD_THIS_YEAR" },
  { id: "custom", labelKey: "DCS_STATS_PERIOD_CUSTOM" },
];
