import { CHART_CATALOG, flatten_schema_fields, field_label_text, is_derived_field, SUBMITTED_AT_FIELD } from "./chartCatalog.js";
import { BUILDER_FORMULAS, KPI_ONLY, type_rules, builder_fields, MAX_WIDGETS } from "./builder/composeWidgets.js";
import { map_levels_of } from "./builder/mapFields.js";
import { ICON_LIBRARIES } from "./icons/iconLibraries.js";
import { FILTER_FIELD_TYPES, MAX_BOARD_FILTERS } from "./boardFilters.js";
import { has_preset_config } from "../fields/presetFields.js";
import { CHART_TEXT, widget_shape } from "./dashboardSpecShape.js";

/**
 * The dashboard creation guide handed to an external AI (Ctrl+6 on the
 * dashboard): everything it needs to write a widget list for THIS form -
 * every data field with its id, type, role and answer values, the widget
 * document key by key, every chart type with what it needs, every formula,
 * filter operator, period, size and limit, plus ready examples built from
 * the form's own fields. Also the reader of what comes back: a pasted
 * { widgets: [...] } normalized into complete widget documents.
 */

/** A pasted widget's over-time settings, or null when it is read all at once. */
function over_time_settings(source) {
  const held = source && source.over_time;
  if (!held || typeof held !== "object" || held.enabled !== true) return null;
  return {
    enabled: true,
    field_id: typeof held.field_id === "string" && held.field_id ? held.field_id : "submitted_at",
    granularity: typeof held.granularity === "string" && held.granularity ? held.granularity : "auto",
    axis: held.axis === "y" ? "y" : "x",
  };
}

const NOT_COLLECTED_TYPES = ["paragraph", "header", "file", "image_block", "horizontal_line", "section", "group", "hidden"];
const CHOICE_TYPES = ["single_select", "multi_select", "cascading_select", "select_group", "likert_scale"];
const MULTI_TYPES = ["multi_select", "ranking"];
const DATE_TYPES = ["date", "date_time"];

const FORMULA_TEXT = {
  count: "Number of submissions (field_id null) or of submissions that answered the field (field_id set).",
  count_distinct: "Number of different answers given to the field.",
  sum: "Sum of the field's numeric answers.",
  avg: "Average (mean) of the field's numeric answers.",
  median: "Median of the field's numeric answers - KPI cards only.",
  min: "Smallest numeric answer.",
  max: "Largest numeric answer.",
  stddev: "Standard deviation of the numeric answers.",
  cumulative_sum: "Running total of the numeric answers over time - KPI cards only.",
  moving_average: "Rolling average of the numeric answers over time - KPI cards only.",
  occurrences:
    "How many times each value of metric.field_id occurs - one row per value. Label each value with display_fields (their answers joined with display_separator, ' - ' by default, e.g. a name and a phone instead of a bare id), narrow or split the counting with same_fields (only records with status 'live'; or only records sharing the same gender), hold every value's count to occurrence_rule, and choose with occurrence_scope whether only the values meeting the rule are shown. A KPI card shows how many DIFFERENT values met the rule and lists them underneath; a chart draws one mark per value. Needs no group_by, takes no split_by or legend_by; allowed looks: kpi, bar, column, lollipop, dot_plot, pie, donut, waffle, treemap, line, area.",
};

function role_of(field) {
  if (is_derived_field(field)) return "derived (computed by the form from other answers and stored with them: group, split, legend or filter by it when it holds a label such as a status; sum, average or compare it when it holds a number)";
  if (field.type === "number") return "numeric";
  if (DATE_TYPES.includes(field.type)) return "date";
  if (CHOICE_TYPES.includes(field.type) || field.type === "ranking") return MULTI_TYPES.includes(field.type) ? "choice (many answers per submission)" : "choice";
  return "text";
}

function option_values(field) {
  if (field.type === "cascading_select" && field.data_source && field.data_source.type === "api") {
    return { source: "api", level: (field.data_source.level || "provinces"), note: "Answers are real Rwandan location names of this level (a province's raw name such as 'Umujyi wa Kigali')." };
  }
  if (field.type === "likert_scale") return Array.from({ length: Number(field.scale_size) || 5 }, (_, index) => index + 1);
  if (field.type === "select_group" && field.parent_dependency_enabled) {
    return (field.parent_option_groups || []).flatMap((group) => ((group && group.options) || []).map((option) => option.value));
  }
  if (Array.isArray(field.options) && field.options.length > 0) {
    return field.options.map((option) => (option.parent_value !== undefined && option.parent_value !== null ? { value: option.value, under_parent_value: option.parent_value } : option.value));
  }
  if (field.lazy_options) return { source: "lazy", note: "Too many options to list here; filter values must be the stored option values." };
  return undefined;
}

/** Every data-collection field of the form as the guide describes it. */
export function describe_form_fields(schema) {
  return flatten_schema_fields((schema && schema.fields) || [])
    .filter((field) => field && field.id && (is_derived_field(field) || !NOT_COLLECTED_TYPES.includes(field.type)))
    .map((field) => {
      const derived = is_derived_field(field);
      const entry = { id: field.id, type: field.type, label: field_label_text(field), role: role_of(field), can_group_or_split: CHOICE_TYPES.includes(field.type) || derived, can_measure_numerically: field.type === "number" || derived, can_drive_time_axis: DATE_TYPES.includes(field.type) };
      if (derived && field.computed && field.computed.formula) entry.formula = field.computed.formula;
      if (field.parent_field_id) entry.parent_field_id = field.parent_field_id;
      const values = option_values(field);
      if (values !== undefined) entry.answer_values = values;
      if (has_preset_config(field)) entry.note = "This field has a preset default: every submission holds the same answer, so do NOT chart or filter on it.";
      return entry;
    });
}

function chart_types_doc() {
  const doc = {};
  CHART_CATALOG.forEach((entry) => {
    const rules = type_rules(entry.type);
    doc[entry.type] = {
      kind: entry.kind,
      needs:
        entry.kind === "kpi"
          ? "metric only (plus optional legend_by, icon)"
          : entry.kind === "point"
            ? "x_field_id and y_field_id (numeric)" + (entry.type === "bubble" ? ", size_field_id (numeric)" : "")
            : entry.kind === "time"
              ? "metric and group_by { field_id: 'submitted_at' or a date field, granularity }"
              : entry.kind === "text"
                ? "text { heading, body } - no metric, no fields, no period"
                : entry.kind === "table"
                  ? "table.mode 'records' with table.fields and table.page_size, or table.mode 'summary' with group_by and either split_by or table.columns"
                  : entry.kind === "canvas"
                    ? "nothing - a layout section"
                    : "metric; group_by (a choice field) is optional",
      split_by: rules.split === "required" ? "required (a second choice field)" : rules.split === "optional" ? "optional" : "not allowed",
      max_slices: rules.slices || undefined,
      description: CHART_TEXT[entry.type] || "",
    };
  });
  return doc;
}

function examples(form, fields) {
  const choice = fields.filter((field) => field.is_choice);
  const numeric = fields.filter((field) => field.is_numeric);
  const date = fields.filter((field) => field.is_date);
  const base = { form_group_id: form.form_group_id, description: "", icon: null, split_by: null, pattern_by: null, legend_by: null, appearance: null, x_field_id: null, y_field_id: null, size_field_id: null, filters: [], period: { preset: "all", from: null, to: null }, sort: "value_desc", limit: 12, position: 0 };
  const out = [];
  out.push({ ...base, id: "w_total", title: "Total submissions", chart_type: "kpi", size: "small", icon: "lucide:ClipboardList", metric: { aggregation: "count", field_id: null }, group_by: null });
  if (choice[0]) {
    out.push({ ...base, id: "w_kpi_legend", title: `Submissions by ${choice[0].label}`, chart_type: "kpi", size: "small", metric: { aggregation: "count", field_id: null }, group_by: null, legend_by: { field_id: choice[0].id } });
    out.push({ ...base, id: "w_column", title: `Submissions per ${choice[0].label}`, chart_type: "column", size: "medium", metric: { aggregation: "count", field_id: null }, group_by: { field_id: choice[0].id } });
    out.push({ ...base, id: "w_donut", title: `Share of ${choice[0].label}`, chart_type: "donut", size: "medium", limit: 6, metric: { aggregation: "count", field_id: null }, group_by: { field_id: choice[0].id } });
    out.push({ ...base, id: "w_line", title: "Submissions over time", chart_type: "line", size: "large", metric: { aggregation: "count", field_id: null }, group_by: { field_id: date[0] ? date[0].id : SUBMITTED_AT_FIELD, granularity: "auto" }, split_by: { field_id: choice[0].id } });
  }
  if (choice[1]) {
    out.push({ ...base, id: "w_stacked", title: `${choice[0].label} by ${choice[1].label}`, chart_type: "stacked_column", size: "large", metric: { aggregation: "count", field_id: null }, group_by: { field_id: choice[0].id }, split_by: { field_id: choice[1].id } });
    out.push({ ...base, id: "w_heatmap", title: `${choice[0].label} vs ${choice[1].label}`, chart_type: "heatmap", size: "large", metric: { aggregation: "count", field_id: null }, group_by: { field_id: choice[0].id }, split_by: { field_id: choice[1].id } });
  }
  if (numeric[0]) {
    out.push({ ...base, id: "w_avg", title: `Average ${numeric[0].label}`, chart_type: "kpi", size: "small", icon: "tabler:IconChartBar", metric: { aggregation: "avg", field_id: numeric[0].id }, group_by: null });
    if (choice[0]) out.push({ ...base, id: "w_sum_bar", title: `Total ${numeric[0].label} per ${choice[0].label}`, chart_type: "bar", size: "medium", metric: { aggregation: "sum", field_id: numeric[0].id }, group_by: { field_id: choice[0].id } });
  }
  if (numeric[1]) out.push({ ...base, id: "w_scatter", title: `${numeric[1].label} / ${numeric[0].label}`, chart_type: "scatter", size: "large", metric: { aggregation: "count", field_id: null }, group_by: null, x_field_id: numeric[0].id, y_field_id: numeric[1].id });
  // A map, whenever the form asks where something happened.
  const places = map_levels_of(fields).filter((entry) => entry.level !== "province");
  if (places[0]) {
    const place = places[0];
    out.push({
      ...base,
      id: "w_map",
      title: `Submissions per ${place.fields[0].label}`,
      chart_type: "map",
      size: "large",
      metric: { aggregation: "count", field_id: null },
      group_by: { field_id: place.fields[0].id },
      map: { mode: "world", level: place.level, marker: "lucide:MapPin", show_markers: false, show_labels: true },
    });
  }
  if (choice[0] && Array.isArray(choice[0].raw.options) && choice[0].raw.options[0]) {
    out.push({ ...base, id: "w_filtered", title: `Total submissions - ${choice[0].raw.options[0].value}`, chart_type: "kpi", size: "small", metric: { aggregation: "count", field_id: null }, group_by: null, filters: [{ field_id: choice[0].id, operator: "eq", value: choice[0].raw.options[0].value }] });
  }
  return out;
}

/** The whole guide for one form, as one JSON-ready object. */
export function build_dashboard_creation_guide(form) {
  const fields = builder_fields(form.schema);
  return {
    how_to_use: [
      "This document fully describes the dashboard widgets of the Data Collection & Monitoring System (DC&MS) and the ONE form they chart.",
      "Paste this ENTIRE document into an external AI assistant together with a plain-language description of the dashboard you want (which numbers matter, which comparisons, which breakdowns).",
      "Ask the AI to reply with ONLY one JSON object shaped like { \"filters\": [ ... ], \"widgets\": [ ... ] } - no prose, no markdown code fences - built strictly from the widget_shape, chart_types, formulas, board_filters and the form's fields listed below.",
      "Copy that JSON reply, paste it into the 'Paste dashboard JSON here' box of the same Ctrl+6 overlay on the dashboard, then choose to add the widgets to the board or to replace the board with them.",
      "Every field_id used anywhere in a widget MUST be one of the ids in form.fields (or 'submitted_at' for the time axis). Never invent a field. Fields marked with a preset note must not be used.",
      "Fields with role 'derived' are values the form computes itself (a confirmation status, a criteria count, a capacity verdict, a household total). They are stored with every submission and are the right thing to chart when a question asks for a status or a total the form already works out - group, legend or filter by a derived label, sum or average a derived number. Their answer_values list what they can hold when the form declares it; their formula shows how they are worked out.",
      "Choose the chart by the data: a choice field alone -> column/bar/donut/pie/lollipop/treemap; two choice fields -> stacked_column/grouped_column/stacked_100/heatmap; a date or the submission date -> line/area; two numeric fields -> scatter (three -> bubble); a single figure -> kpi.",
      "To show a measure for each value of a field, prefer ONE widget that carries the values inside it - a KPI card with legend_by, or a chart with that field as group_by or split_by - over one filtered widget per value (see one_widget_or_many).",
      "A board answers two different questions: how much there is now, and how it is changing. Cover both - leave most widgets as they are, and turn a few of the ones a reader will want a trend for over time (see over_time), rather than adding a second widget that repeats the first with a date on its axis.",
      "Set each chart's size to the share of a row it deserves: small (a third), medium (a half) or large (a whole row). Neighbours that still fit share the row, so a row of three small charts or one large chart alone both work.",
      "A REPORT-STYLE board (a printed situation report rebuilt on screen) uses four more things. TEXT blocks (chart_type 'text') for its title bands, observations and recommendations. TABLES (chart_type 'table') for its figures: a summary table with one row per district and a column per measure or per value of a second field, with totals, or a records table of the submissions themselves. period.locked: true on a widget that must keep its own dates whatever the board's date filter says. pinned_fields on a widget that must keep its breakdown when the board is filtered - a row of one card per district stays a row of one card per district. Group each page of such a report in a canvas (a dark section), and put its widgets inside with parent_id and box.",
      "Category charts need a choice field in group_by; numeric formulas (sum, avg, min, max, stddev, median, cumulative_sum, moving_average) need a numeric field in metric.field_id; count may leave field_id null to count submissions.",
      "Titles are plain language for the readers of the board (e.g. 'Submissions per district'); keep them under 120 characters and unique.",
      `A dashboard holds at most ${MAX_WIDGETS} widgets in total, including the ones already on the board when adding.`,
      "The server validates every widget against the form; an invalid widget list is refused as a whole with the first violation shown, so follow the rules exactly.",
      ...(form.tracking && form.tracking.enabled === true
        ? [
            `RECORD TRACKING. This form is a register: its records are found again by the key field '${form.tracking.key_field_id}' and updated on the fields ${JSON.stringify(form.tracking.editable_field_ids || [])}. Inside any selected period, every widget reads each of those updatable fields with the value it held at that period's END (the record keeps every value with the moment it started and ended), never today's value - so a status chart of last year shows last year's statuses. A widget over time by 'updated_at' charts when records were changed.`,
          ]
        : []),
    ],
    top_level_shape: {
      filters: "Optional. The board's filter fields: an array of { field_id } - see board_filters. Viewers pick a value in each and every widget follows.",
      widgets: "Array of widget objects, in the order they should appear on the board (left to right, top to bottom).",
    },
    board_filters: board_filters_doc(),
    one_widget_or_many: {
      description:
        "Showing a measure 'for each' value of a field can be done two ways, and ONE widget is almost always the better answer. Prefer a single widget carrying the values inside it; only produce one widget per value when each value really deserves its own card on the board.",
      one_kpi_card_with_a_legend: "Put the field in legend_by and leave filters empty: the card shows the overall total, with one line per value of that field underneath it. legend_by works on KPI cards only, with any formula except median, cumulative_sum and moving_average (those cannot be split, so they need one card per value).",
      one_chart_instead_of_many: "Put the field in group_by (one bar, column or slice per value), or in split_by alongside another group_by for a grouped or stacked chart. One chart then carries every value.",
      one_widget_per_value: "Only then: repeat the widget once per value, each with filters: [{ field_id: <the field>, operator: 'eq', value: <one answer> }] and the value named in its title.",
      example_one_card: { id: "w_by_district", title: "Beneficiaries by district", chart_type: "kpi", size: "small", metric: { aggregation: "count", field_id: null }, group_by: null, legend_by: { field_id: "<a choice field>" }, filters: [] },
      example_count_occurrences: { id: "w_repeat_ids", title: "People registered more than once", chart_type: "kpi", size: "small", metric: { aggregation: "occurrences", field_id: "<an id field>" }, display_fields: ["<a name field>", "<a phone field>"], display_separator: " - ", same_fields: [{ field_id: "<a status field>", value: "live" }, { field_id: "<a gender field>", value: null }], occurrence_rule: { operator: "gt", value: 1 }, occurrence_scope: "matching", group_by: null, filters: [] },
      example_many_cards: [
        { id: "w_gasabo", title: "Beneficiaries - Gasabo", chart_type: "kpi", size: "small", metric: { aggregation: "count", field_id: null }, group_by: null, filters: [{ field_id: "<a choice field>", operator: "eq", value: "Gasabo" }] },
        { id: "w_kicukiro", title: "Beneficiaries - Kicukiro", chart_type: "kpi", size: "small", metric: { aggregation: "count", field_id: null }, group_by: null, filters: [{ field_id: "<a choice field>", operator: "eq", value: "Kicukiro" }] },
      ],
    },
    form: { form_group_id: form.form_group_id, form_name: form.form_name || "", fields: describe_form_fields(form.schema), pseudo_fields: { submitted_at: "When each submission was recorded - the default time axis of line and area charts." } },
    widget_shape: widget_shape(),
    chart_types: chart_types_doc(),
    formulas: Object.fromEntries(BUILDER_FORMULAS.map((formula) => [formula.id, { description: FORMULA_TEXT[formula.id] || "", numeric_field_required: !!formula.numeric, kpi_only: KPI_ONLY.includes(formula.id) }])),
    filter_operators: { eq: "equals", ne: "does not equal", contains: "text contains", gt: "greater than (numbers)", gte: "greater or equal (numbers)", lt: "less than (numbers)", lte: "less or equal (numbers)", empty: "the field was not answered (missing, blank or an empty list) - no value", not_empty: "the field was answered - no value" },
    period_presets: ["all", "today", "this_week", "this_month", "last_month", "this_year", "custom (needs from, optional to, as ISO dates)"],
    time_granularities: ["auto", "hour", "day", "week", "month", "year"],
    sort_options: ["value_desc", "value_asc", "label_asc"],
    sizes: ["small", "medium", "large", "full"],
    limits: { max_widgets: MAX_WIDGETS, max_title_length: 120, max_description_length: 300, max_filters: 10, max_limit: 50, max_slices_on_pie_donut_waffle: 6 },
    icon_libraries: ICON_LIBRARIES.map((library) => library.id),
    examples_for_this_form: examples(form, fields),
  };
}

/**
 * How the board's filters work, for the external AI: which fields may
 * filter, what a picked value does to every widget, and a worked example.
 */
function board_filters_doc() {
  return {
    description:
      "A dashboard can carry FILTERS: choice fields of the form listed at top level as filters: [{ field_id }]. Viewers pick a value in each filter (or 'All') and EVERY widget of the board follows every picked value - the whole board is recomputed under them.",
    allowed_field_types: FILTER_FIELD_TYPES.concat(["(single_select is a select or radio; cascading_select is a chain such as district -> sector -> cell; select_group is a grouped select)"]),
    rules: [
      `Only fields of the allowed types may be filters; at most ${MAX_BOARD_FILTERS}, each field once. Use the field_id from form.fields.`,
      "A picked value narrows the RECORDS of every widget: 'Deaths per district' under gender = male counts male deaths only, in every district.",
      "A widget whose group_by is the filtered field DRILLS DOWN: 'Records per district' under district = Kigali shows Kigali's SECTORS (the field whose parent is district), and its title becomes 'Records per district (Kigali)'. Picking a sector too shows that sector's cells. A field with no child (gender) simply shows the one picked value.",
      "A KPI card whose legend_by is the filtered field loses its legend: 'People by gender' (total 200, male 90, female 110) under gender = male shows the male total alone, no legend. A legend on a cascading field moves down to the child instead.",
      "A split_by or pattern_by on the filtered field moves to the child field; with no child the chart keeps its group_by and simply shows the one picked segment (a stacked chart by gender under gender = male draws the male segments only).",
      "A widget left with nothing to show under the filters is hidden from the board until they change; the filter bar above the board is what says which values everything runs under.",
      "Prefer filters on fields the widgets read (their group_by, split_by, legend_by) so filtering reshapes the board, plus the fields readers slice by most (location chain, gender, status). Do not add a filter on a field no widget uses unless readers clearly need it.",
      "Widgets keep their own 'filters' (fixed conditions) - board filters are added on top of them.",
    ],
    example: {
      filters: [{ field_id: "<a district cascading_select field>" }, { field_id: "<a gender single_select field>" }],
      widgets: [
        { id: "w_by_district", title: "Records per district", chart_type: "column", size: "medium", metric: { aggregation: "count", field_id: null }, group_by: { field_id: "<a district cascading_select field>" }, filters: [] },
        { id: "w_by_gender", title: "People by gender", chart_type: "kpi", size: "small", metric: { aggregation: "count", field_id: null }, group_by: null, legend_by: { field_id: "<a gender single_select field>" }, filters: [] },
        { id: "w_deaths", title: "Deaths per district", chart_type: "bar", size: "medium", metric: { aggregation: "sum", field_id: "<a deaths number field>" }, group_by: { field_id: "<a district cascading_select field>" }, filters: [] },
      ],
    },
    worked_example:
      "With the example above and district = Kigali picked: 'Records per district (Kigali)' and 'Deaths per district (Kigali)' list Kigali's sectors; 'People by gender' counts Kigali only, still split male / female. Picking gender = male as well: the KPI shows the male total alone with no legend, and both charts count male records only.",
  };
}

/** Reads { filters, widgets } (or a bare widget array) from pasted text: { widgets, filters | null }. */
export function parse_pasted_dashboard(raw_text) {
  const parsed = JSON.parse(raw_text);
  if (Array.isArray(parsed)) return { widgets: parsed, filters: null };
  if (parsed && Array.isArray(parsed.widgets)) return { widgets: parsed.widgets, filters: Array.isArray(parsed.filters) ? parsed.filters : null };
  throw new Error("not_a_widget_array");
}

/** Reads { widgets: [...] } or a bare [...] from pasted text. */
export function parse_pasted_widgets(raw_text) {
  return parse_pasted_dashboard(raw_text).widgets;
}

/**
 * Completes pasted board filters: { filters: [{ field_id }], unknown_fields }
 * - fields the form lacks are reported, fields of a type that cannot filter
 * are dropped silently, duplicates folded, the limit applied.
 */
export function normalize_pasted_filters(form, pasted) {
  const fields = flatten_schema_fields((form.schema && form.schema.fields) || []);
  const by_id = new Map(fields.map((field) => [field.id, field]));
  const unknown = [];
  const seen = new Set();
  const filters = [];
  (Array.isArray(pasted) ? pasted : []).forEach((entry) => {
    const field_id = entry && typeof entry === "object" ? entry.field_id : entry;
    if (typeof field_id !== "string" || !field_id || seen.has(field_id)) return;
    seen.add(field_id);
    const field = by_id.get(field_id);
    if (!field) unknown.push(field_id);
    else if (FILTER_FIELD_TYPES.includes(field.type) && filters.length < MAX_BOARD_FILTERS) filters.push({ field_id });
  });
  return { filters, unknown_fields: unknown };
}

/**
 * Completes pasted widgets into full documents: this form's id on each,
 * a fresh unique id where missing or duplicated, every optional key
 * present, and positions in array order. Returns { widgets, unknown_fields }
 * where unknown_fields lists every field id not found on the form.
 */
/**
 * A pasted map's own settings. The two kinds share nothing but the mode
 * itself, so each keeps only what it is drawn from - a heat map carrying a
 * level, or a world map carrying a position field, would be a map that
 * cannot make up its mind.
 */
function map_settings(source) {
  if (source.chart_type !== "map" || !source.map || typeof source.map !== "object") return null;
  const held = source.map;
  if (held.mode === "heat") {
    return {
      mode: "heat",
      point_field_id: typeof held.point_field_id === "string" ? held.point_field_id : null,
      weight_field_id: typeof held.weight_field_id === "string" ? held.weight_field_id : null,
      radius: Number(held.radius) || null,
      intensity: Number(held.intensity) || null,
      show_points: held.show_points !== false,
      low_color: typeof held.low_color === "string" ? held.low_color : null,
      high_color: typeof held.high_color === "string" ? held.high_color : null,
    };
  }
  return {
    mode: "world",
    level: held.level,
    marker: typeof held.marker === "string" ? held.marker : null,
    show_markers: held.show_markers === true,
    show_labels: held.show_labels !== false,
  };
}
export function normalize_pasted_widgets(form, pasted) {
  const known = new Set(flatten_schema_fields((form.schema && form.schema.fields) || []).map((field) => field.id));
  known.add(SUBMITTED_AT_FIELD);
  const unknown = new Set();
  const seen = new Set();
  const stamp = Date.now();
  const check = (id) => {
    if (id && !known.has(id)) unknown.add(id);
  };
  const ref = (value) => {
    if (!value || typeof value !== "object" || !value.field_id) return null;
    check(value.field_id);
    return value.granularity ? { field_id: value.field_id, granularity: value.granularity } : { field_id: value.field_id };
  };
  const widgets = pasted.map((widget, index) => {
    const source = widget && typeof widget === "object" ? widget : {};
    let id = typeof source.id === "string" && source.id.trim() ? source.id.trim() : "";
    if (!id || seen.has(id)) id = `p_${form.form_group_id}_${stamp}_${index + 1}`;
    seen.add(id);
    const metric = source.metric && typeof source.metric === "object" ? source.metric : { aggregation: "count", field_id: null };
    check(metric.field_id);
    [source.x_field_id, source.y_field_id, source.size_field_id].forEach(check);
    const filters = (Array.isArray(source.filters) ? source.filters : []).map((filter) =>
      filter && ["empty", "not_empty"].includes(filter.operator) ? { field_id: filter.field_id, operator: filter.operator, value: "" } : filter,
    );
    filters.forEach((filter) => filter && check(filter.field_id));
    const display_fields = Array.isArray(source.display_fields) ? source.display_fields.filter((id) => typeof id === "string" && id).slice(0, 5) : [];
    display_fields.forEach(check);
    const display_separator = typeof source.display_separator === "string" ? source.display_separator.slice(0, 10) : " - ";
    const same_fields = (Array.isArray(source.same_fields) ? source.same_fields : [])
      .filter((entry) => entry && typeof entry === "object" && typeof entry.field_id === "string" && entry.field_id)
      .map((entry) => ({ field_id: entry.field_id, value: entry.value === undefined || entry.value === null || String(entry.value).trim() === "" ? null : entry.value }))
      .slice(0, 5);
    same_fields.forEach((entry) => check(entry.field_id));
    const rule = source.occurrence_rule && typeof source.occurrence_rule === "object" && source.occurrence_rule.operator ? { operator: source.occurrence_rule.operator, value: Number(source.occurrence_rule.value) } : null;
    // Every field a table or a pin names must be one of the form's too.
    (Array.isArray(source.pinned_fields) ? source.pinned_fields : []).forEach(check);
    const table = source.table && typeof source.table === "object" ? source.table : {};
    (Array.isArray(table.fields) ? table.fields : []).forEach(check);
    if (table.sort && typeof table.sort === "object" && table.sort.field_id && table.sort.field_id !== SUBMITTED_AT_FIELD) check(table.sort.field_id);
    (Array.isArray(table.columns) ? table.columns : []).forEach((column) => {
      if (!column || typeof column !== "object") return;
      check(column.field_id);
      (Array.isArray(column.filters) ? column.filters : []).forEach((filter) => filter && check(filter.field_id));
    });
    return {
      id,
      form_group_id: form.form_group_id,
      title: typeof source.title === "string" ? source.title.trim().slice(0, 120) : "",
      description: typeof source.description === "string" ? source.description.slice(0, 300) : "",
      icon: typeof source.icon === "string" && source.icon ? source.icon : null,
      chart_type: source.chart_type,
      metric: { aggregation: metric.aggregation || "count", field_id: metric.field_id || null },
      group_by: ref(source.group_by),
      split_by: ref(source.split_by),
      pattern_by: ref(source.pattern_by),
      legend_by: ref(source.legend_by),
      display_fields,
      display_separator,
      same_fields,
      occurrence_rule: rule,
      occurrence_scope: source.occurrence_scope === "all" ? "all" : rule ? "matching" : "all",
      appearance: source.appearance && typeof source.appearance === "object" ? source.appearance : null,
      // A map's own settings: which boundaries it draws and how it marks them.
      map: map_settings(source),
      // Read as the period passes, rather than all at once.
      over_time: over_time_settings(source),
      // Where it sits: inside a canvas, and how it lays itself out there.
      parent_id: typeof source.parent_id === "string" && source.parent_id ? source.parent_id : null,
      box: source.box && typeof source.box === "object" ? source.box : null,
      canvas: source.chart_type === "canvas" ? Object.assign({ flow: "row", gap: 12, place: "flow", width: null, height: null, min_width: null, max_width: null, min_height: null, max_height: null }, source.canvas || {}) : null,
      // Words on the board, and a table's settings - kept whole; the
      // server reduces both to what it understands and refuses the rest.
      text: source.chart_type === "text" && source.text && typeof source.text === "object" ? source.text : null,
      table: source.chart_type === "table" && source.table && typeof source.table === "object" ? source.table : null,
      // The board filters this widget does not follow.
      pinned_fields: Array.isArray(source.pinned_fields) ? source.pinned_fields.filter((id) => typeof id === "string" && id) : [],
      x_field_id: source.x_field_id || null,
      y_field_id: source.y_field_id || null,
      size_field_id: source.size_field_id || null,
      filters,
      period: source.period && typeof source.period === "object" && source.period.preset ? source.period : { preset: "all", from: null, to: null },
      sort: source.sort || "value_desc",
      limit: Number.isInteger(Number(source.limit)) && Number(source.limit) > 0 ? Number(source.limit) : type_rules(source.chart_type).slices || (source.chart_type === "treemap" ? 50 : 12),
      size: source.size || (source.chart_type === "kpi" ? "small" : "medium"),
      position: index,
    };
  });
  return { widgets, unknown_fields: Array.from(unknown) };
}
