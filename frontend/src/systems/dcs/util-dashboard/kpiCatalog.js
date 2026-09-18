import { classify_fields, field_label_text, flatten_schema_fields, is_derived_field } from "./chartCatalog.js";
import { is_cascade_child, category_display } from "./autoGenerate.js";
import { has_preset_config } from "../fields/presetFields.js";

/**
 * The manual KPI catalog: every formula a KPI card offers, which fields may
 * carry one, and the builder that turns a chosen field + formula into the
 * KPI card PLUS its automatic breakdowns - the KPI categorized by every
 * choice field of the form (each cascading level included), each breakdown
 * carrying the KPI's own title and description.
 */

// EXACTLY the requested formula catalog: Sum, Average (mean), Median,
// Count, Minimum, Maximum, Standard deviation, Cumulative sum, Moving
// average. Numeric formulas need a number field; Count accepts any offered
// field. KPI_ONLY formulas cannot group per category, so their breakdowns
// use the closest groupable formula instead (see BREAKDOWN_AGGREGATION).
export const KPI_FORMULAS = [
  { id: "sum", labelKey: "DCS_DB_F_SUM", hintKey: "DCS_DB_F_SUM_HINT", numeric: true },
  { id: "avg", labelKey: "DCS_DB_F_AVG", hintKey: "DCS_DB_F_AVG_HINT", numeric: true },
  { id: "median", labelKey: "DCS_DB_F_MEDIAN", hintKey: "DCS_DB_F_MEDIAN_HINT", numeric: true },
  { id: "count", labelKey: "DCS_DB_F_COUNT", hintKey: "DCS_DB_F_COUNT_HINT", numeric: false },
  { id: "min", labelKey: "DCS_DB_F_MIN", hintKey: "DCS_DB_F_MIN_HINT", numeric: true },
  { id: "max", labelKey: "DCS_DB_F_MAX", hintKey: "DCS_DB_F_MAX_HINT", numeric: true },
  { id: "stddev", labelKey: "DCS_DB_F_STDDEV", hintKey: "DCS_DB_F_STDDEV_HINT", numeric: true },
  { id: "cumulative_sum", labelKey: "DCS_DB_F_CUMSUM", hintKey: "DCS_DB_F_CUMSUM_HINT", numeric: true },
  { id: "moving_average", labelKey: "DCS_DB_F_MOVAVG", hintKey: "DCS_DB_F_MOVAVG_HINT", numeric: true },
  // How many times each value of a field occurs - one row per value,
  // labelled by chosen display fields, held to an optional threshold.
  { id: "occurrences", labelKey: "DCS_DB_F_OCCURRENCES", hintKey: "DCS_DB_F_OCCURRENCES_HINT", numeric: false },
];

export const formula_definition = (formula_id) => KPI_FORMULAS.find((entry) => entry.id === formula_id) || null;

// The per-category form of each formula: median, cumulative sum and moving
// average cannot group per category, so their breakdowns chart the closest
// groupable reading of the same field (a running total per category IS its
// total; a rolling average per category IS its average).
const BREAKDOWN_AGGREGATION = {
  count: "count",
  sum: "sum",
  avg: "avg",
  median: "avg",
  min: "min",
  max: "max",
  stddev: "stddev",
  cumulative_sum: "sum",
  moving_average: "avg",
};

// ONLY data-collection components may carry a KPI - a form also holds pure
// DESIGN components (paragraphs, headers, file/image blocks, horizontal
// lines, sections, groups) that collect nothing, so eligibility is a
// WHITELIST of answer-collecting types: anything unknown is left out by
// construction. Files/media, dates/times and location fields are excluded
// on purpose, and nested cascading levels are not offered either - they
// only ever appear as the automatically generated breakdown dimensions.
const KPI_FIELD_TYPES = [
  "number",
  "text",
  "large_text",
  "email",
  "url",
  "phone",
  "single_select",
  "multi_select",
  "select_group",
  "cascading_select",
  "likert_scale",
  "ranking",
];

export function kpi_field_type_key(field) {
  if (is_derived_field(field)) return "DCS_DB_FT_DERIVED";
  if (field.type === "number") return "DCS_DB_FT_NUMBER";
  if (field.type === "large_text") return "DCS_DB_FT_LARGE_TEXT";
  if (["single_select", "select_group", "cascading_select", "likert_scale"].includes(field.type)) return "DCS_DB_FT_SINGLE";
  if (["multi_select", "ranking"].includes(field.type)) return "DCS_DB_FT_MULTI";
  return "DCS_DB_FT_TEXT";
}

export function eligible_kpi_fields(schema) {
  return flatten_schema_fields((schema && schema.fields) || []).filter(
    (field) => field && field.id && (KPI_FIELD_TYPES.includes(field.type) || is_derived_field(field)) && !is_cascade_child(field) && !has_preset_config(field),
  );
}

/**
 * EVERY formula is offered on every field - no filtering by type: numeric
 * formulas simply SKIP the answers they cannot read as numbers when the
 * data is fetched (the card counts and lists them), so nothing breaks.
 */
export function formulas_for_field(field) {
  void field;
  return KPI_FORMULAS;
}

// The choice family: fields whose KPI fans out into one card per value.
export const CHOICE_FIELD_TYPES = ["single_select", "multi_select", "select_group", "cascading_select", "likert_scale", "ranking"];

/**
 * The option values of a choice field (radio/select family) as DEFINED in
 * the schema - for a parent-dependent select group, the options of every
 * group combined. The caller unions these with the values actually present
 * in the collected data (fetched from the backend), because API-sourced
 * cascadings and likert scales define no inline options at all.
 */
export function field_option_values(field) {
  if (field.type === "select_group" && field.parent_dependency_enabled) {
    const values = [];
    (field.parent_option_groups || []).forEach((group) => {
      ((group && group.options) || []).forEach((option) => {
        if (option && option.value !== undefined && option.value !== null && !values.includes(option.value)) {
          values.push(option.value);
        }
      });
    });
    return values;
  }
  return (field.options || [])
    .map((option) => option && option.value)
    .filter((value) => value !== undefined && value !== null && String(value).trim().length > 0);
}

/**
 * The KPI card, one KPI card PER VALUE when the field is a choice field -
 * whatever the formula: "Count of Gender" spawns "Count of Gender - Male",
 * "... - Female", "... - Other", and "Average income of District" spawns
 * one card per district, each filtered to its value. option_values carries
 * the values to fan out over (schema options unioned with the values found
 * in the collected data); without it the schema options alone are used.
 * Plus one breakdown chart per OTHER choice field of the form (cascading
 * levels included). Every widget carries the KPI's title and description.
 */
export function build_kpi_widgets(form, field, formula_id, title, description, translate, option_values) {
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

  // A choice field fans the formula out over its values too: one KPI card
  // per value, each filtered to records that picked it.
  (option_values || field_option_values(field)).forEach((option_value) => {
    widgets.push(
      make({
        title: `${title} - ${String(option_value)}`.slice(0, 120),
        chart_type: "kpi",
        size: "small",
        filters: [{ field_id: field.id, operator: "eq", value: option_value }],
      }),
    );
  });

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
