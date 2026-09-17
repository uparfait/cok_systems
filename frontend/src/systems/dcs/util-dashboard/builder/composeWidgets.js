import { chart_definition, flatten_schema_fields, field_label_text, SUBMITTED_AT_FIELD } from "../chartCatalog.js";
import { KPI_FORMULAS } from "../kpiCatalog.js";
import { has_preset_config } from "../../fields/presetFields.js";

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
  { id: "filters", labelKey: "DCS_DB_TAB_FILTERS" },
  { id: "map", labelKey: "DCS_DB_TAB_MAP" },
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

// "Count occurrences": the counted values ARE the categories, so the
// formula only ever draws a KPI card or a single-series chart.
export const OCCURRENCES = "occurrences";
export const is_occurrences = (aggregation) => aggregation === OCCURRENCES;
export const OCCURRENCE_CHART_TYPES = ["column", "bar", "lollipop", "dot_plot", "pie", "donut", "line", "area"];
export const OCCURRENCE_DIAGRAM_TYPES = ["treemap", "waffle"];

/** The occurrence options of a spec as the widget keys they are stored under. */
export function occurrence_extra(spec) {
  const has_rule = !!spec.rule_operator;
  return {
    display_fields: Array.isArray(spec.display_ids) ? spec.display_ids.filter(Boolean).slice(0, 5) : [],
    display_separator: typeof spec.display_separator === "string" ? spec.display_separator.slice(0, 10) : " - ",
    same_fields: (Array.isArray(spec.same_rules) ? spec.same_rules : [])
      .filter((entry) => entry && entry.field_id)
      .map((entry) => ({ field_id: entry.field_id, value: entry.value === undefined || entry.value === null || String(entry.value).trim() === "" ? null : entry.value }))
      .slice(0, 5),
    occurrence_rule: has_rule ? { operator: spec.rule_operator, value: Number(spec.rule_value) } : null,
    occurrence_scope: has_rule ? spec.rule_scope || "matching" : "all",
  };
}

/** Why an occurrence choice cannot be built yet: a threshold picked without a number. */
export function occurrence_problem(spec, translate) {
  if (!is_occurrences(spec.formula_id || spec.aggregation)) return "";
  if (spec.rule_operator && !(Number.isFinite(Number(spec.rule_value)) && String(spec.rule_value).trim() !== "" && Number(spec.rule_value) >= 0)) {
    return translate("DCS_DB_OCC_NEED_VALUE");
  }
  return "";
}
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
  // The map colours boundaries instead of bars, from the same category data.
  map: { kind: "category", split: "optional" },
};
export const type_rules = (chart_type) => TYPE_RULES[chart_type] || { kind: "category", split: "none" };

const HINT_KEYS = {
  bar: "DCS_DB_HINT_BAR", column: "DCS_DB_HINT_COLUMN", grouped_column: "DCS_DB_HINT_GROUPED", lollipop: "DCS_DB_HINT_LOLLIPOP",
  dot_plot: "DCS_DB_HINT_DOT", line: "DCS_DB_HINT_LINE", area: "DCS_DB_HINT_AREA", stacked_column: "DCS_DB_HINT_STACKED",
  stacked_100: "DCS_DB_HINT_STACKED_100", pie: "DCS_DB_HINT_PIE", donut: "DCS_DB_HINT_DONUT", waffle: "DCS_DB_HINT_WAFFLE",
  treemap: "DCS_DB_HINT_TREEMAP", map: "DCS_DB_HINT_MAP", scatter: "DCS_DB_HINT_SCATTER", bubble: "DCS_DB_HINT_BUBBLE", heatmap: "DCS_DB_HINT_HEATMAP",
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

/**
 * Every data-collection field of the form, annotated with the roles it can
 * play. A field with a preset default is never offered: it always holds
 * the same answer, so there is nothing to compare or count on it.
 */
export function builder_fields(schema) {
  return flatten_schema_fields((schema && schema.fields) || [])
    .filter((field) => field && field.id && !NOT_COLLECTED_TYPES.includes(field.type) && !has_preset_config(field))
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

// The pseudo field a Count KPI may read instead of a real one: every
// submission of the form inside the selected time window.
export const ALL_SUBMISSIONS_ID = "__all_submissions__";

export function all_submissions_field(translate) {
  return { id: ALL_SUBMISSIONS_ID, type: "__all__", label: translate("DCS_DB_GEN_TOTAL"), is_choice: false, is_numeric: false, is_date: false, is_total: true };
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
    pattern_by: null,
    legend_by: null,
    display_fields: [],
    display_separator: " - ",
    same_fields: [],
    occurrence_rule: null,
    occurrence_scope: "all",
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
 * optional "in each" field, whether that field makes ONE card or one per
 * value, which field the card's legend lists, and whether a chart can
 * accompany it (and in which shape).
 *
 * An "in each" field normally fans out into one card per value. Combined
 * (the default) it stays a SINGLE card instead, with those values listed
 * as its legend under the total - the same numbers, one widget. Only a
 * formula that can be grouped supports that legend, so median, cumulative
 * sum and moving average always fan out.
 */
export function kpi_shape(spec, fields) {
  const occurrences = is_occurrences(spec.formula_id);
  // Occurrences count a REAL field's values - never whole submissions.
  const measure = fields.find((field) => field.id === spec.field_id && !(occurrences && field.is_total)) || null;
  const in_each = fields.find((field) => field.id === spec.in_each_id && field.id !== spec.field_id) || null;
  const groupable = !!spec.formula_id && !KPI_ONLY.includes(spec.formula_id) && !occurrences;
  // The legend a choice MEASURE gives every card on its own. An occurrence
  // card lists its counted values itself, so it never takes a legend field.
  const measure_legend = measure && measure.is_choice && groupable ? measure : null;
  const can_combine = !!in_each && in_each.is_choice && groupable;
  const combined = can_combine && (spec.in_each_mode || "combined") === "combined";
  // One card carrying the "in each" values as its legend; otherwise the
  // measure's own values, when it is a choice field.
  const legend = combined ? in_each : measure_legend;
  const split = !!(in_each && measure_legend);
  // An occurrence chart draws the counted values themselves.
  const chart_field = occurrences ? measure : in_each || (measure && measure.is_choice ? measure : null);
  const chart_types = !chart_field ? [] : occurrences ? OCCURRENCE_CHART_TYPES.concat(OCCURRENCE_DIAGRAM_TYPES) : split ? SPLIT_CHART_TYPES : SINGLE_CHART_TYPES;
  return { measure, in_each, occurrences, can_combine, combined, legend, measure_legend, split, chart_field, chart_types };
}

export function measure_label(formula_id, field, translate) {
  const formula = formula_of(formula_id);
  if (!formula) return "";
  if (field && field.is_total) return translate("DCS_DB_GEN_TOTAL");
  if (!field) return translate(formula.labelKey);
  return translate("DCS_DB_KPI_DEFAULT_TITLE", { formula: translate(formula.labelKey), field: field.label });
}

/** How many KPI cards a choice produces before it is built. */
export function kpi_card_count(spec, fields, values) {
  const shape = kpi_shape(spec, fields);
  if (!shape.in_each || shape.combined) return 1;
  return (values || []).length;
}

/** The KPI cards (one per "in each" value, or a single one) plus the optional chart. */
export function build_kpi_drafts(form, spec, values, translate) {
  const shape = kpi_shape(spec, fields_from_spec(spec, form));
  const title = (spec.title || "").trim();
  const description = (spec.description || "").trim();
  // "All submissions" counts records themselves: no field behind the metric.
  const measure_id = shape.measure.is_total ? null : shape.measure.id;
  const metric = { aggregation: spec.formula_id, field_id: measure_id };
  const legend_by = shape.legend ? { field_id: shape.legend.id } : null;
  const appearance = spec.appearance || null;
  // The occurrence options ride on every widget the choice produces.
  const extra = shape.occurrences ? occurrence_extra(spec) : {};
  const widgets = [];

  if (shape.in_each && !shape.combined) {
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
          ...extra,
        }),
      );
    });
  } else {
    widgets.push(make_widget(form, { title, description, chart_type: "kpi", size: "small", metric, legend_by, appearance, ...extra }));
  }

  if (spec.chart_enabled && shape.chart_field && shape.chart_types.includes(spec.chart_type)) {
    const rules = type_rules(spec.chart_type);
    widgets.push(
      make_widget(form, {
        title: shape.in_each && !shape.occurrences ? translate("DCS_DB_GEN_VS", { a: title, b: shape.in_each.label }) : title,
        description,
        chart_type: spec.chart_type,
        // An occurrence chart keeps the very same metric: the counted values
        // are its categories, so it groups by nothing else.
        metric: shape.occurrences ? metric : { aggregation: GROUPED_EQUIVALENT[spec.formula_id] || spec.formula_id, field_id: measure_id },
        group_by: shape.occurrences ? null : { field_id: shape.chart_field.id },
        split_by: shape.split ? { field_id: shape.measure_legend.id } : null,
        limit: rules.slices || (spec.chart_type === "treemap" ? 50 : 12),
        size: shape.split ? "large" : "medium",
        appearance,
        ...extra,
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
    else if (formula.id === "count" && spec.field_id && spec.field_id !== ALL_SUBMISSIONS_ID && !field(spec.field_id)) problems.push(translate("DCS_DB_NEED_MEASURE_FIELD"));
  }
  // Occurrences group by their own counted field and take a single-series
  // look: nothing else to pick, only a threshold that needs its number.
  if (is_occurrences(spec.aggregation)) {
    if (!OCCURRENCE_CHART_TYPES.concat(OCCURRENCE_DIAGRAM_TYPES).includes(spec.chart_type)) problems.push(translate("DCS_DB_OCC_TYPE_UNAVAILABLE"));
    const rule_problem = occurrence_problem(spec, translate);
    if (rule_problem) problems.push(rule_problem);
    if (!(spec.title || "").trim()) problems.push(translate("DCS_DB_NEED_TITLE"));
    return problems;
  }
  if (rules.kind === "category" || rules.kind === "tree") {
    // Group by is optional: with none the split values become the
    // categories, and with neither the chart draws the one total.
    const group = field(spec.group_id);
    if (spec.group_id && !(group && group.is_choice)) problems.push(translate("DCS_DB_NEED_GROUP"));
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
  // A combined chart puts the "in each" values on an axis (or draws one
  // line per value), which only a choice field can do.
  if (spec.in_each_id && spec.in_each_mode === "combined" && combined_layout(spec) && !(field(spec.in_each_id) || {}).is_choice) {
    problems.push(translate("DCS_DB_NEED_COMBINED_CHOICE"));
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
  const counts_all = spec.aggregation === "count" && (!spec.field_id || spec.field_id === ALL_SUBMISSIONS_ID);
  const measure = counts_all ? translate("DCS_DB_GEN_TOTAL") : measure_label(spec.aggregation, field(spec.field_id), translate);
  if (!measure) return "";
  if (is_occurrences(spec.aggregation)) return measure;
  const in_each = is_combined(spec) ? field(spec.in_each_id) : null;
  const with_in_each = (text) => (in_each ? `${text} - ${translate("DCS_DB_DRAFT_IN_EACH", { field: in_each.label })}` : text);
  if (rules.kind === "time") return with_in_each(translate("DCS_DB_OVER_TIME_TITLE", { measure }));
  const group = field(spec.group_id);
  if (!group) return with_in_each(measure);
  const split = field(spec.split_id);
  const base = translate("DCS_DB_GEN_VS", { a: measure, b: group.label });
  return with_in_each(split && rules.split !== "none" ? translate("DCS_DB_GEN_VS", { a: base, b: split.label }) : base);
}

// The look a single-series chart takes when its "in each" values are drawn
// side by side on ONE chart: the "in each" field runs along the axis and the
// original grouping becomes the series, so every bar carries its total.
const COMBINED_TYPE = {
  bar: "stacked_bar",
  column: "stacked_column",
  lollipop: "grouped_column",
  dot_plot: "grouped_column",
  pie: "stacked_column",
  donut: "stacked_column",
  waffle: "stacked_100",
  treemap: "stacked_column",
  area: "line",
};

/**
 * How a chart with an "in each" field lays out as ONE combined chart, or
 * null when the type cannot combine (point charts only filter). Category
 * and tree charts put the "in each" values on the axis and keep the
 * original grouping (or split) as the series; time charts draw one line
 * per "in each" value.
 */
export function combined_layout(spec) {
  if (!spec.in_each_id || !spec.chart_type) return null;
  const rules = type_rules(spec.chart_type);
  // Point charts only filter, and an occurrence chart's axis is already
  // taken by the counted values - both fan out instead.
  if (rules.kind === "point" || is_occurrences(spec.aggregation)) return null;
  if (rules.kind === "time") return { chart_type: "line", group_id: spec.group_id, split_id: spec.in_each_id, pattern_id: "", time: true };
  const has_split = rules.split !== "none" && !!spec.split_id;
  // Three fields on one chart: the "in each" values on the axis, the split
  // as colors and the original grouping as a pattern inside each color.
  return {
    chart_type: COMBINED_TYPE[spec.chart_type] || (has_split && spec.chart_type === "heatmap" ? "stacked_column" : spec.chart_type),
    group_id: spec.in_each_id,
    split_id: has_split ? spec.split_id : spec.group_id,
    pattern_id: has_split ? spec.group_id : "",
    time: false,
  };
}

export const is_combined = (spec) => spec.in_each_id && spec.in_each_mode === "combined" && combined_layout(spec) !== null;

/** The spec actually charted when the "in each" values are combined on one chart. */
function combined_spec(spec) {
  const layout = combined_layout(spec);
  if (!layout) return spec;
  return { ...spec, chart_type: layout.chart_type, group_id: layout.group_id, split_id: layout.split_id, pattern_id: layout.pattern_id, in_each_id: "" };
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
  // Count reads "Total submissions" (no field) unless a real field was picked
  // - counting only the records that answered it.
  const counts_all = spec.aggregation === "count" && (!spec.field_id || spec.field_id === ALL_SUBMISSIONS_ID);
  extra.metric = { aggregation: spec.aggregation, field_id: counts_all ? null : spec.field_id };
  // Occurrences: the counted field's values are the categories.
  if (is_occurrences(spec.aggregation)) {
    return Object.assign(extra, { group_by: null, split_by: null, pattern_by: null }, occurrence_extra(spec));
  }
  if (rules.kind === "time") {
    extra.group_by = { field_id: spec.time_source || SUBMITTED_AT_FIELD, granularity: spec.granularity || "auto" };
    extra.split_by = rules.split === "optional" && spec.split_id ? { field_id: spec.split_id } : null;
    extra.size = "large";
    return extra;
  }
  extra.group_by = spec.group_id ? { field_id: spec.group_id } : null;
  extra.split_by = rules.split !== "none" && spec.split_id ? { field_id: spec.split_id } : null;
  extra.pattern_by = extra.split_by && spec.pattern_id ? { field_id: spec.pattern_id } : null;
  return extra;
}

/** One map widget, stamped with its id and form like every other draft. */
export function build_map_draft(form, extra) {
  return make_widget(form, extra);
}

/**
 * One chart; or - with an "in each" field - either one COMBINED chart with
 * the values side by side, or one chart per value, each filtered to its
 * value and suffixed with it.
 */
export function build_chart_drafts(form, spec, values) {
  const title = spec.title.trim().slice(0, 120);
  if (is_combined(spec)) return [make_widget(form, { ...chart_widget_extra(combined_spec(spec)), title, size: "large" })];
  const extra = chart_widget_extra(spec);
  if (!spec.in_each_id || !Array.isArray(values) || values.length === 0) return [make_widget(form, { ...extra, title })];
  return values.map((value) =>
    make_widget(form, { ...extra, title: `${title} - ${String(value)}`.slice(0, 120), filters: [{ field_id: spec.in_each_id, operator: "eq", value }] }),
  );
}

/**
 * The field whose values a widget colors one by one: a KPI's legend field,
 * a split chart's split field, a category / tree chart's group field, or -
 * when it counts occurrences, which has no group_by - the field whose
 * answers are being counted. Time-only, point and plain KPI widgets have
 * none.
 */
export function appearance_values_field(widget, fields) {
  const find = (ref) => (ref && ref.field_id ? fields.find((field) => field.id === ref.field_id) || null : null);
  if (widget.legend_by) return find(widget.legend_by);
  if (widget.split_by) return find(widget.split_by);
  const kind = type_rules(widget.chart_type).kind;
  if ((kind === "category" || kind === "tree") && widget.group_by) return find(widget.group_by);
  if (widget.metric && widget.metric.aggregation === "occurrences") return find(widget.metric);
  return null;
}

/** Positions every widget of a save in order and strips builder-only keys. */
export function finalize_widgets(widgets) {
  return widgets.map((widget, index) => ({ ...widget, position: index }));
}
