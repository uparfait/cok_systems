import { chart_definition, flatten_schema_fields, field_label_text, SUBMITTED_AT_FIELD } from "../chartCatalog.js";
import { KPI_FORMULAS } from "../kpiCatalog.js";

/**
 * Pure helpers of the dashboard builder: the fields a form offers, the
 * formula and chart catalogs of each tab, what a chosen combination means
 * (how many cards, which legend, which chart shapes), and the widget
 * documents it turns into. No React here - the composers only render what
 * these functions decide.
 */

export const MAX_WIDGETS = 150;

export const TABS = [
  { id: "kpi", labelKey: "DCS_DB_TAB_KPI" },
  { id: "charts", labelKey: "DCS_DB_TAB_CHARTS" },
  { id: "diagrams", labelKey: "DCS_DB_TAB_DIAGRAMS" },
];

const CHOICE_TYPES = ["single_select", "multi_select", "cascading_select", "select_group", "likert_scale"];
const MULTI_TYPES = ["multi_select", "ranking"];
const NUMERIC_TYPES = ["number"];
const DATE_TYPES = ["date", "date_time"];
const TEXT_TYPES = ["text", "large_text", "email", "url", "phone"];

// Median, cumulative sum and moving average exist only on a KPI card; their
// per-category chart reads the closest groupable formula instead.
export const KPI_ONLY = ["median", "cumulative_sum", "moving_average"];
const GROUPED_EQUIVALENT = { median: "avg", cumulative_sum: "sum", moving_average: "avg" };

const DISTINCT = { id: "count_distinct", labelKey: "DCS_DB_F_COUNT_DISTINCT", hintKey: "DCS_DB_F_COUNT_DISTINCT_HINT", numeric: false };
export const BUILDER_FORMULAS = KPI_FORMULAS.flatMap((formula) => (formula.id === "count" ? [formula, DISTINCT] : [formula]));
export const CHART_FORMULAS = BUILDER_FORMULAS.filter((formula) => !KPI_ONLY.includes(formula.id));
export const formula_of = (id) => BUILDER_FORMULAS.find((formula) => formula.id === id) || null;

export const SINGLE_CHART_TYPES = ["column", "bar", "donut", "pie", "lollipop", "dot_plot", "waffle", "treemap"];
export const SPLIT_CHART_TYPES = ["stacked_column", "grouped_column", "stacked_100", "stacked_bar", "grouped_bar", "stacked_bar_100", "heatmap"];
export const CHART_TAB_TYPES = ["column", "bar", "lollipop", "dot_plot", "grouped_column", "grouped_bar", "stacked_column", "stacked_bar", "stacked_100", "stacked_bar_100", "pie", "donut", "line", "area"];
export const DIAGRAM_TAB_TYPES = ["treemap", "heatmap", "waffle", "scatter", "bubble"];

// Mirrors the backend chart vocabulary: what each type groups on and
// whether it takes a second (split) choice field.
const TYPE_RULES = {
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
};
export const type_rules = (chart_type) => TYPE_RULES[chart_type] || { kind: "category", split: "none" };

const HINT_KEYS = {
  bar: "DCS_DB_HINT_BAR", column: "DCS_DB_HINT_COLUMN", grouped_column: "DCS_DB_HINT_GROUPED", lollipop: "DCS_DB_HINT_LOLLIPOP",
  dot_plot: "DCS_DB_HINT_DOT", line: "DCS_DB_HINT_LINE", area: "DCS_DB_HINT_AREA", stacked_column: "DCS_DB_HINT_STACKED",
  stacked_100: "DCS_DB_HINT_STACKED_100", pie: "DCS_DB_HINT_PIE", donut: "DCS_DB_HINT_DONUT", waffle: "DCS_DB_HINT_WAFFLE",
  treemap: "DCS_DB_HINT_TREEMAP", scatter: "DCS_DB_HINT_SCATTER", bubble: "DCS_DB_HINT_BUBBLE", heatmap: "DCS_DB_HINT_HEATMAP",
};
export const type_hint_key = (chart_type) => HINT_KEYS[chart_type] || null;
export const type_label = (chart_type, translate) => {
  const definition = chart_definition(chart_type);
  return definition ? translate(definition.labelKey) : chart_type;
};

// Form-design components collect nothing (headers, paragraphs, files shown
// to the respondent, image blocks, lines, the section canvas and the group
// box), and hidden fields are never answered by anyone - none of them is
// offered in the pickers.
const NOT_COLLECTED_TYPES = ["paragraph", "header", "file", "image_block", "horizontal_line", "section", "group", "hidden"];

/** Every data-collection field of the form, annotated with the roles it can play. */
export function builder_fields(schema) {
  return flatten_schema_fields((schema && schema.fields) || [])
    .filter((field) => field && field.id && !NOT_COLLECTED_TYPES.includes(field.type))
    .map((field) => ({
      id: field.id,
      type: field.type,
      label: field_label_text(field),
      is_choice: CHOICE_TYPES.includes(field.type),
      is_numeric: NUMERIC_TYPES.includes(field.type),
      is_date: DATE_TYPES.includes(field.type),
      raw: field,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function field_type_key(field) {
  if (NUMERIC_TYPES.includes(field.type)) return "DCS_DB_FT_NUMBER";
  if (DATE_TYPES.includes(field.type)) return "DCS_DB_FT_DATE";
  if (MULTI_TYPES.includes(field.type)) return "DCS_DB_FT_MULTI";
  if (CHOICE_TYPES.includes(field.type)) return "DCS_DB_FT_SINGLE";
  if (field.type === "large_text") return "DCS_DB_FT_LARGE_TEXT";
  if (TEXT_TYPES.includes(field.type)) return "DCS_DB_FT_TEXT";
  return null;
}

/** Options for the field pickers: the label, with the field's type as a badge. */
export function field_options(fields, translate) {
  return fields.map((field) => {
    const key = field_type_key(field);
    const type = key ? translate(key) : String(field.type || "").replace(/_/g, " ");
    return { id: field.id, name: field.label, badge: type };
  });
}

let sequence = 0;
function make_widget(form, extra) {
  sequence += 1;
  return {
    id: `b_${form.form_group_id}_${Date.now()}_${sequence}`,
    form_group_id: form.form_group_id,
    title: "",
    description: "",
    icon: null,
    metric: { aggregation: "count", field_id: null },
    group_by: null,
    split_by: null,
    legend_by: null,
    appearance: null,
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
}

/**
 * What a KPI choice means before anything is built: the measure field, the
 * optional "in each" field, whether the cards carry a legend, and whether a
 * chart can accompany them (and in which shape).
 */
export function kpi_shape(spec, fields) {
  const measure = fields.find((field) => field.id === spec.field_id) || null;
  const in_each = fields.find((field) => field.id === spec.in_each_id && field.id !== spec.field_id) || null;
  const groupable = !!spec.formula_id && !KPI_ONLY.includes(spec.formula_id);
  const legend = measure && measure.is_choice && groupable ? measure : null;
  const split = !!(in_each && legend);
  const chart_field = in_each || (measure && measure.is_choice ? measure : null);
  return { measure, in_each, legend, split, chart_field, chart_types: chart_field ? (split ? SPLIT_CHART_TYPES : SINGLE_CHART_TYPES) : [] };
}

export function measure_label(formula_id, field, translate) {
  const formula = formula_of(formula_id);
  if (!formula) return "";
  if (!field) return translate(formula.labelKey);
  return translate("DCS_DB_KPI_DEFAULT_TITLE", { formula: translate(formula.labelKey), field: field.label });
}

/** The KPI cards (one per "in each" value, or a single one) plus the optional chart. */
export function build_kpi_drafts(form, spec, values, translate) {
  const shape = kpi_shape(spec, fields_from_spec(spec, form));
  const title = (spec.title || "").trim();
  const description = (spec.description || "").trim();
  const metric = { aggregation: spec.formula_id, field_id: shape.measure.id };
  const legend_by = shape.legend ? { field_id: shape.legend.id } : null;
  const appearance = spec.appearance || null;
  const widgets = [];

  if (shape.in_each) {
    values.forEach((value) => {
      widgets.push(
        make_widget(form, {
          title: `${title} - ${String(value)}`.slice(0, 120),
          description,
          chart_type: "kpi",
          size: "small",
          metric,
          legend_by,
          appearance,
          filters: [{ field_id: shape.in_each.id, operator: "eq", value }],
        }),
      );
    });
  } else {
    widgets.push(make_widget(form, { title, description, chart_type: "kpi", size: "small", metric, legend_by, appearance }));
  }

  if (spec.chart_enabled && shape.chart_field && shape.chart_types.includes(spec.chart_type)) {
    const rules = type_rules(spec.chart_type);
    widgets.push(
      make_widget(form, {
        title: shape.in_each ? translate("DCS_DB_GEN_VS", { a: title, b: shape.in_each.label }) : title,
        description,
        chart_type: spec.chart_type,
        metric: { aggregation: GROUPED_EQUIVALENT[spec.formula_id] || spec.formula_id, field_id: shape.measure.id },
        group_by: { field_id: shape.chart_field.id },
        split_by: shape.split ? { field_id: shape.legend.id } : null,
        limit: rules.slices || (spec.chart_type === "treemap" ? 50 : 12),
        size: shape.split ? "large" : "medium",
        appearance,
      }),
    );
  }
  return widgets;
}

function fields_from_spec(spec, form) {
  return spec.fields || builder_fields(form.schema);
}

/** The reasons a chart choice cannot be built yet, in the order the form shows them. */
export function chart_spec_problems(spec, fields, translate) {
  const problems = [];
  const rules = type_rules(spec.chart_type);
  const field = (id) => fields.find((entry) => entry.id === id) || null;
  if (!spec.chart_type) problems.push(translate("DCS_DB_NEED_TYPE"));
  if (rules.kind !== "point") {
    const formula = formula_of(spec.aggregation);
    if (!formula) problems.push(translate("DCS_DB_KPI_PICK_FORMULA"));
    else if (formula.id !== "count" && !field(spec.field_id)) problems.push(translate("DCS_DB_NEED_MEASURE_FIELD"));
  }
  if (rules.kind === "category" || rules.kind === "tree") {
    const group = field(spec.group_id);
    if (!group || !group.is_choice) problems.push(translate("DCS_DB_NEED_GROUP"));
    if (rules.split === "required") {
      const split = field(spec.split_id);
      if (!split || !split.is_choice || split.id === spec.group_id) problems.push(translate("DCS_DB_NEED_SPLIT"));
    }
  }
  if (rules.kind === "time") {
    const source = spec.time_source === SUBMITTED_AT_FIELD ? true : (field(spec.time_source) || {}).is_date;
    if (!source) problems.push(translate("DCS_DB_NEED_TIME"));
    if (rules.split === "optional" && spec.split_id && !(field(spec.split_id) || {}).is_choice) problems.push(translate("DCS_DB_NEED_SPLIT"));
  }
  if (rules.kind === "point") {
    if (!(field(spec.x_id) || {}).is_numeric || !(field(spec.y_id) || {}).is_numeric) problems.push(translate("DCS_DB_NEED_XY"));
    if (spec.chart_type === "bubble" && !(field(spec.size_id) || {}).is_numeric) problems.push(translate("DCS_DB_NEED_SIZE"));
  }
  if (!(spec.title || "").trim()) problems.push(translate("DCS_DB_NEED_TITLE"));
  return problems;
}

/** A readable default title for a chart choice, from what it charts. */
export function default_chart_title(spec, fields, translate) {
  const rules = type_rules(spec.chart_type);
  const field = (id) => fields.find((entry) => entry.id === id) || null;
  if (!spec.chart_type) return "";
  if (rules.kind === "point") {
    const x = field(spec.x_id);
    const y = field(spec.y_id);
    return x && y ? `${y.label} / ${x.label}` : "";
  }
  const measure = spec.aggregation === "count" ? translate("DCS_DB_AGG_COUNT") : measure_label(spec.aggregation, field(spec.field_id), translate);
  if (!measure) return "";
  if (rules.kind === "time") return translate("DCS_DB_OVER_TIME_TITLE", { measure });
  const group = field(spec.group_id);
  if (!group) return measure;
  const split = field(spec.split_id);
  const base = translate("DCS_DB_GEN_VS", { a: measure, b: group.label });
  return split && rules.split !== "none" ? translate("DCS_DB_GEN_VS", { a: base, b: split.label }) : base;
}

/** The widget keys one chart choice produces, before ids, titles and filters. */
function chart_widget_extra(spec) {
  const rules = type_rules(spec.chart_type);
  const extra = {
    description: (spec.description || "").trim(),
    chart_type: spec.chart_type,
    size: spec.size || "medium",
    limit: rules.slices || (spec.chart_type === "treemap" ? 50 : 12),
    appearance: spec.appearance || null,
  };
  if (rules.kind === "point") {
    return Object.assign(extra, { x_field_id: spec.x_id, y_field_id: spec.y_id, size_field_id: spec.chart_type === "bubble" ? spec.size_id : null });
  }
  extra.metric = { aggregation: spec.aggregation, field_id: spec.aggregation === "count" ? null : spec.field_id };
  if (rules.kind === "time") {
    extra.group_by = { field_id: spec.time_source || SUBMITTED_AT_FIELD, granularity: spec.granularity || "auto" };
    extra.split_by = rules.split === "optional" && spec.split_id ? { field_id: spec.split_id } : null;
    extra.size = "large";
    return extra;
  }
  extra.group_by = { field_id: spec.group_id };
  extra.split_by = rules.split !== "none" && spec.split_id ? { field_id: spec.split_id } : null;
  return extra;
}

/**
 * One chart, or - with an "in each" field - one chart per value of it,
 * each filtered to its value and suffixed with it.
 */
export function build_chart_drafts(form, spec, values) {
  const extra = chart_widget_extra(spec);
  const title = spec.title.trim().slice(0, 120);
  if (!spec.in_each_id || !Array.isArray(values) || values.length === 0) return [make_widget(form, { ...extra, title })];
  return values.map((value) =>
    make_widget(form, { ...extra, title: `${title} - ${String(value)}`.slice(0, 120), filters: [{ field_id: spec.in_each_id, operator: "eq", value }] }),
  );
}

/**
 * The field whose values a widget colors one by one: a KPI's legend field,
 * a split chart's split field, or a category / tree chart's group field.
 * Time-only, point and plain KPI widgets have none.
 */
export function appearance_values_field(widget, fields) {
  const find = (ref) => (ref && ref.field_id ? fields.find((field) => field.id === ref.field_id) || null : null);
  if (widget.legend_by) return find(widget.legend_by);
  if (widget.split_by) return find(widget.split_by);
  const kind = type_rules(widget.chart_type).kind;
  if ((kind === "category" || kind === "tree") && widget.group_by) return find(widget.group_by);
  return null;
}

/** Positions every widget of a save in order and strips builder-only keys. */
export function finalize_widgets(widgets) {
  return widgets.map((widget, index) => ({ ...widget, position: index }));
}
