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
  const flat = flatten_schema_fields((schema && schema.fields) || []);
  return {
    all: flat.filter((field) => field && field.id),
    categorical: flat.filter((field) => CATEGORICAL_TYPES.includes(field.type)),
    numeric: flat.filter((field) => NUMERIC_TYPES.includes(field.type)),
    dates: flat.filter((field) => DATE_TYPES.includes(field.type)),
  };
}
