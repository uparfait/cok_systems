import { has_preset_config } from "../fields/presetFields.js";

/**
 * The frontend mirror of the backend chart vocabulary plus the field
 * classification the automatic generator works from. Dashboards are
 * generated - never hand-configured - so this catalog only needs each chart
 * type's kind and display name.
 */

// kind: category | time | point | tree | kpi (matches the backend).
export const CHART_CATALOG = [
  { type: "bar", kind: "category", labelKey: "DCS_DB_CHART_BAR" },
  { type: "column", kind: "category", labelKey: "DCS_DB_CHART_COLUMN" },
  { type: "grouped_column", kind: "category", labelKey: "DCS_DB_CHART_GROUPED" },
  { type: "lollipop", kind: "category", labelKey: "DCS_DB_CHART_LOLLIPOP" },
  { type: "dot_plot", kind: "category", labelKey: "DCS_DB_CHART_DOT" },
  { type: "line", kind: "time", labelKey: "DCS_DB_CHART_LINE" },
  { type: "area", kind: "time", labelKey: "DCS_DB_CHART_AREA" },
  { type: "stacked_column", kind: "category", labelKey: "DCS_DB_CHART_STACKED" },
  { type: "stacked_100", kind: "category", labelKey: "DCS_DB_CHART_STACKED_100" },
  { type: "grouped_bar", kind: "category", labelKey: "DCS_DB_CHART_GROUPED_BAR" },
  { type: "stacked_bar", kind: "category", labelKey: "DCS_DB_CHART_STACKED_BAR" },
  { type: "stacked_bar_100", kind: "category", labelKey: "DCS_DB_CHART_STACKED_BAR_100" },
  { type: "pie", kind: "category", labelKey: "DCS_DB_CHART_PIE" },
  { type: "donut", kind: "category", labelKey: "DCS_DB_CHART_DONUT" },
  { type: "waffle", kind: "category", labelKey: "DCS_DB_CHART_WAFFLE" },
  { type: "treemap", kind: "tree", labelKey: "DCS_DB_CHART_TREEMAP" },
  { type: "scatter", kind: "point", labelKey: "DCS_DB_CHART_SCATTER" },
  { type: "bubble", kind: "point", labelKey: "DCS_DB_CHART_BUBBLE" },
  { type: "heatmap", kind: "category", labelKey: "DCS_DB_CHART_HEATMAP" },
  { type: "kpi", kind: "kpi", labelKey: "DCS_DB_CHART_KPI" },
];

export const chart_definition = (type) => CHART_CATALOG.find((entry) => entry.type === type) || null;

// Every look a widget can be flipped into, driven by what its data can
// express (all 20 chart types of the catalog are reachable through these
// families). A single-series category widget can become any single-series
// look - bars, columns, lollipops, dots, slices, waffle, treemap, or a
// line/area across its categories. A split widget (one field categorized
// by another - many x values each carrying many y values) can become any
// grouped/stacked/100-percent bar or column form (grouped bars are the
// clustered bar chart), a heatmap, or a multi-series line. Time widgets
// flip between line and area, scatter flips to bubble only when it carries
// a size field, and a KPI card is its own thing.
const SINGLE_CATEGORY_TYPES = ["bar", "column", "lollipop", "dot_plot", "pie", "donut", "waffle", "treemap", "line", "area"];
const SPLIT_CATEGORY_TYPES = ["grouped_column", "grouped_bar", "stacked_column", "stacked_bar", "stacked_100", "stacked_bar_100", "heatmap", "line"];

export function convertible_types(widget) {
  if (!widget || widget.chart_type === "kpi") return [];
  if (["scatter", "bubble"].includes(widget.chart_type)) {
    return widget.size_field_id ? ["scatter", "bubble"] : ["scatter"];
  }
  // An occurrence widget's categories are its counted values: every
  // single-series look is reachable, whatever it groups by.
  if (widget.metric && widget.metric.aggregation === "occurrences") return SINGLE_CATEGORY_TYPES;
  const group = widget.group_by || null;
  if (!group || !group.field_id) return [];
  // A time source is submitted_at, or any group that carries a granularity
  // (only time widgets ever do) - those stay in the time family.
  if (group.field_id === SUBMITTED_AT_FIELD || group.granularity) {
    return widget.split_by && widget.split_by.field_id ? ["line"] : ["line", "area"];
  }
  return widget.split_by && widget.split_by.field_id ? SPLIT_CATEGORY_TYPES : SINGLE_CATEGORY_TYPES;
}

/**
 * Chart types whose data is identical map to one family token: every
 * bar/column-style chart shares one aggregation, every slice chart (capped
 * at 6 with the tail folded into Other) shares another, and every split
 * chart (stacked, grouped, 100 percent, heatmap - vertical or horizontal)
 * shares a third. Flipping the look inside a family never needs a refetch.
 */
export function fold_family(type) {
  if (["bar", "column", "lollipop", "dot_plot"].includes(type)) return "bars";
  if (["pie", "donut", "waffle"].includes(type)) return "slices";
  if (["grouped_column", "stacked_column", "stacked_100", "grouped_bar", "stacked_bar", "stacked_bar_100", "heatmap"].includes(type)) {
    return "split";
  }
  return type;
}

/**
 * Everything that decides a widget's DATA (never its look or wording) - two
 * widget lists with equal signatures chart the exact same numbers.
 */
export function widgets_data_signature(widget_list) {
  return JSON.stringify(
    widget_list.map((widget) => [
      widget.id,
      fold_family(widget.chart_type),
      widget.metric,
      widget.group_by,
      widget.split_by,
      widget.x_field_id,
      widget.y_field_id,
      widget.size_field_id,
      widget.filters,
      widget.period,
      widget.sort,
      widget.limit,
      widget.display_fields,
      widget.display_separator,
      widget.same_fields,
      widget.occurrence_rule,
      widget.occurrence_scope,
    ]),
  );
}

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
 * The chartable fields of one form, grouped by the role the generator uses
 * them in: choice fields to chart, number fields to average, date fields
 * for time series.
 */
export function classify_fields(schema) {
  // A preset field always holds the same answer - nothing to chart on it.
  const flat = flatten_schema_fields((schema && schema.fields) || []).filter((field) => !has_preset_config(field));
  return {
    all: flat.filter((field) => field && field.id),
    categorical: flat.filter((field) => CATEGORICAL_TYPES.includes(field.type)),
    numeric: flat.filter((field) => NUMERIC_TYPES.includes(field.type)),
    dates: flat.filter((field) => DATE_TYPES.includes(field.type)),
  };
}
