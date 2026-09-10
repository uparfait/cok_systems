import { classify_fields, field_label_text, flatten_schema_fields } from "./chartCatalog.js";
import { is_cascade_child, category_display } from "./autoGenerate.js";

/**
 * The manual KPI catalog: every formula a KPI card offers, which fields may
 * carry one, and the builder that turns a chosen field + formula into the
 * KPI card PLUS its automatic breakdowns - the KPI categorized by every
 * choice field of the form (each cascading level included), each breakdown
 * carrying the KPI's own title and description.
 */

// Numeric formulas need a number field; the rest (counting) accept any
// offered field. KPI_ONLY formulas cannot group per category, so their
// breakdowns use the closest groupable formula instead (see
// BREAKDOWN_AGGREGATION).
export const KPI_FORMULAS = [
  { id: "sum", labelKey: "DCS_DB_F_SUM", hintKey: "DCS_DB_F_SUM_HINT", numeric: true },
  { id: "avg", labelKey: "DCS_DB_F_AVG", hintKey: "DCS_DB_F_AVG_HINT", numeric: true },
  { id: "median", labelKey: "DCS_DB_F_MEDIAN", hintKey: "DCS_DB_F_MEDIAN_HINT", numeric: true },
  { id: "count", labelKey: "DCS_DB_F_COUNT", hintKey: "DCS_DB_F_COUNT_HINT", numeric: false },
  { id: "count_distinct", labelKey: "DCS_DB_F_COUNT_DISTINCT", hintKey: "DCS_DB_F_COUNT_DISTINCT_HINT", numeric: false },
  { id: "min", labelKey: "DCS_DB_F_MIN", hintKey: "DCS_DB_F_MIN_HINT", numeric: true },
  { id: "max", labelKey: "DCS_DB_F_MAX", hintKey: "DCS_DB_F_MAX_HINT", numeric: true },
  { id: "stddev", labelKey: "DCS_DB_F_STDDEV", hintKey: "DCS_DB_F_STDDEV_HINT", numeric: true },
  { id: "cumulative_sum", labelKey: "DCS_DB_F_CUMSUM", hintKey: "DCS_DB_F_CUMSUM_HINT", numeric: true },
  { id: "moving_average", labelKey: "DCS_DB_F_MOVAVG", hintKey: "DCS_DB_F_MOVAVG_HINT", numeric: true },
];

export const formula_definition = (formula_id) => KPI_FORMULAS.find((entry) => entry.id === formula_id) || null;

// The per-category form of each formula: median, cumulative sum and moving
// average cannot group per category, so their breakdowns chart the closest
// groupable reading of the same field (a running total per category IS its
// total; a rolling average per category IS its average).
const BREAKDOWN_AGGREGATION = {
  count: "count",
  count_distinct: "count_distinct",
  sum: "sum",
  avg: "avg",
  median: "avg",
  min: "min",
  max: "max",
  stddev: "stddev",
  cumulative_sum: "sum",
  moving_average: "avg",
};

// Containers, files/media, dates and location fields never carry a KPI;
// nested cascading levels are not offered either - they only ever appear as
// the automatically generated breakdown dimensions.
const EXCLUDED_FIELD_TYPES = [
  "group",
  "section",
  "date",
  "date_time",
  "time",
  "duration",
  "image",
  "video",
  "audio",
  "file_upload",
  "signature",
  "geolocation",
  "hidden",
];

export function kpi_field_type_key(field) {
  if (field.type === "number") return "DCS_DB_FT_NUMBER";
  if (field.type === "large_text") return "DCS_DB_FT_LARGE_TEXT";
  if (["single_select", "select_group", "cascading_select", "likert_scale"].includes(field.type)) return "DCS_DB_FT_SINGLE";
  if (["multi_select", "ranking"].includes(field.type)) return "DCS_DB_FT_MULTI";
  return "DCS_DB_FT_TEXT";
}

export function eligible_kpi_fields(schema) {
  return flatten_schema_fields((schema && schema.fields) || []).filter(
    (field) => field && field.id && field.type && !EXCLUDED_FIELD_TYPES.includes(field.type) && !is_cascade_child(field),
  );
}

export function formulas_for_field(field) {
  const numeric = field && field.type === "number";
  return KPI_FORMULAS.filter((formula) => numeric || !formula.numeric);
}

/**
 * The KPI card plus one breakdown per choice field of the form (cascading
 * levels included, the KPI's own field excluded): "Average income" spawns
 * "Average income by status", "... by gender", "... by district", "... by
 * sector" and so on. Every widget carries the title and description the
 * user typed on the KPI.
 */
export function build_kpi_widgets(form, field, formula_id, title, description, translate) {
  const stamp = Date.now();
  let sequence = 0;
  const make = (extra) => {
    sequence += 1;
    return {
      id: `kpi_${form.form_group_id}_${stamp}_${sequence}`,
      form_group_id: form.form_group_id,
      description: description || "",
      metric: { aggregation: formula_id, field_id: formula_id === "count" ? null : field.id },
      group_by: null,
      split_by: null,
      x_field_id: null,
      y_field_id: null,
      size_field_id: null,
      filters: [],
      period: { preset: "all", from: null, to: null },
      sort: "value_desc",
      limit: 12,
      size: "medium",
      position: 0,
      ...extra,
    };
  };

  const widgets = [make({ title, chart_type: "kpi", size: "small" })];

  const breakdown_aggregation = BREAKDOWN_AGGREGATION[formula_id] || "count";
  const additive = breakdown_aggregation === "count" || breakdown_aggregation === "sum";
  const fields = classify_fields(form.schema);
  fields.categorical.forEach((category_field) => {
    if (category_field.id === field.id) return;
    const display = category_display(category_field, fields.all, additive);
    widgets.push(
      make({
        title: translate("DCS_DB_GEN_VS", { a: title, b: field_label_text(category_field) }),
        chart_type: display.chart_type,
        group_by: { field_id: category_field.id },
        metric: {
          aggregation: breakdown_aggregation,
          field_id: breakdown_aggregation === "count" ? null : field.id,
        },
        limit: display.limit,
        size: display.size,
      }),
    );
  });
  return widgets;
}
