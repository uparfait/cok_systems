import { CHART_CATALOG, flatten_schema_fields, field_label_text, SUBMITTED_AT_FIELD } from "./chartCatalog.js";
import { BUILDER_FORMULAS, KPI_ONLY, type_rules, builder_fields, MAX_WIDGETS } from "./builder/composeWidgets.js";
import { map_levels_of } from "./builder/mapFields.js";
import { ICON_LIBRARIES } from "./icons/iconLibraries.js";
import { FILTER_FIELD_TYPES, MAX_BOARD_FILTERS } from "./boardFilters.js";
import { has_preset_config } from "../fields/presetFields.js";

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

const CHART_TEXT = {
  bar: "Horizontal bars, one per value of group_by.",
  column: "Vertical columns, one per value of group_by.",
  grouped_column: "Columns per group_by value, one column per split_by value side by side.",
  lollipop: "A thin stem with a dot per group_by value.",
  dot_plot: "One dot per group_by value.",
  line: "A line over time (group_by is submitted_at or a date field); split_by draws one line per value.",
  area: "A filled area over time.",
  stacked_column: "Columns per group_by value stacked by split_by value.",
  stacked_100: "Stacked columns normalized to 100 percent.",
  grouped_bar: "Horizontal grouped bars.",
  stacked_bar: "Horizontal stacked bars.",
  stacked_bar_100: "Horizontal stacked bars normalized to 100 percent.",
  pie: "Slices per group_by value, at most 6 (the rest folded into Other).",
  donut: "A pie with a hole, at most 6 slices.",
  waffle: "A 10x10 grid of squares showing shares, at most 6 values.",
  treemap: "Nested rectangles sized by value, one per group_by value.",
  map: "A real map (MapLibre), drawn one of two ways. map.mode \"world\" fills administrative boundaries: one shape per group_by value, each in a color of its own, with its name written inside it and its number on its marker, and every parent above them outlined behind - it needs map.level and a group_by field whose answers are place names (the form's district, sector, cell or village field), and only places inside the City of Kigali have boundaries. map.mode \"heat\" spreads the records themselves, each at the position it was collected: it needs map.point_field_id, a field of type geolocation, and NOTHING else about places - no level, no group_by, no markers. A form without a geolocation field cannot hold a heat map.",
  scatter: "Points from two numeric fields (x_field_id, y_field_id).",
  bubble: "A scatter whose point size comes from a third numeric field (size_field_id).",
  heatmap: "A grid of group_by values by split_by values, colored by the measure.",
  kpi: "A single big number card, optionally with a legend (legend_by) listing the counts per value of a choice field.",
  canvas:
    "A SECTION OF THE LAYOUT - free space that other widgets sit inside. It is design, not data: it reads no field, takes no formula, no group_by, no period, no over_time, and it draws no chart, no legend and no total. Nothing is fetched for it and nothing can be clicked into it. " +
    "Its title and description are OPTIONAL, unlike every other widget: BOTH may be left out. A canvas that simply holds three widgets side by side needs no heading, so leave the title as an empty string and the description null unless a heading genuinely helps the page read - an unnamed canvas draws no title bar at all, just the widgets in it. " +
    "SIZE IS NEVER A REASON TO LEAVE SOMETHING OUT. A widget drawn in a box smaller than its content needs is scaled down as a whole to fit the box - never cut off - and a KPI's number shrinks to the width of its card down to 8px and is never broken across lines. So place and size widgets for the PAGE, not for their text: a wide number, a long legend or a tall chart all fit whatever box they are given. " +
    "Think of it as a SECTION of the page: a section holds widgets, a widget holds data. Nothing about data belongs on a canvas - no unit, no compact, no legend_position, no value_colors, no icon, no size. Give it only its own colors (background, border, border_width, and text if it carries a heading) and its canvas layout. An unnamed canvas draws no heading and no padding at all, so its widgets start flush at the top - which is what a section usually wants. " +
    "Widgets join it by naming its id in their parent_id and lay themselves out inside it with their own box. Use one to group related widgets, or to put a few side by side at sizes the board's own grid cannot give them; do not wrap a single widget in one, and do not use one where the ordinary grid would do.",
};

function role_of(field) {
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
    .filter((field) => field && field.id && !NOT_COLLECTED_TYPES.includes(field.type))
    .map((field) => {
      const entry = { id: field.id, type: field.type, label: field_label_text(field), role: role_of(field), can_group_or_split: CHOICE_TYPES.includes(field.type), can_measure_numerically: field.type === "number", can_drive_time_axis: DATE_TYPES.includes(field.type) };
      if (field.parent_field_id) entry.parent_field_id = field.parent_field_id;
      const values = option_values(field);
      if (values !== undefined) entry.answer_values = values;
      if (has_preset_config(field)) entry.note = "This field has a preset default: every submission holds the same answer, so do NOT chart or filter on it.";
      return entry;
    });
}

function widget_shape() {
  return {
    id: "Optional unique string; generated when missing.",
    title: "Required, 1-120 characters. What the card shows, in plain words. The one exception is a canvas, whose title may be an empty string because it is a section of the layout rather than a question.",
    description: "Optional, up to 300 characters, shown under the title.",
    chart_type: `One of: ${Object.keys(CHART_TEXT).join(", ")} (see chart_types).`,
    metric: "{ aggregation, field_id } - the measure. aggregation is one of the formulas; field_id is a numeric field for numeric formulas, any field (or null for whole submissions) for count, any field for count_distinct. Point charts (scatter, bubble) ignore metric.",
    group_by: "{ field_id } for category and tree charts (a choice field); { field_id, granularity } for time charts where field_id is 'submitted_at' or a date field and granularity is one of the time_granularities. null for KPI and point charts. Optional everywhere else too: with no group_by the chart draws one mark per split_by value, and with neither it draws the single total of what it selects.",
    map: "Maps only. A world map: { mode: \"world\", level, marker, show_markers, show_labels }. level is one of province, district, sector, cell, village and must match the group_by field (a district map groups by the form's district field). marker is an icon id like \"lucide:MapPin\" (any icon of the icon libraries - an icon a library no longer carries is looked up by the same name in the others, so a marker never comes out blank), show_markers plants it on every place with that place's number, and show_labels writes the place names. With a split_by every place plants that same icon once per value, in the value's own color, and the legend names the values. A heat map instead: { mode: \"heat\", point_field_id, weight_field_id, radius, intensity, show_points, low_color, high_color }. point_field_id is the form's geolocation field and is required; weight_field_id is a number field each answer is weighed by (left out, every answer weighs one); radius 6-80 and intensity 0.2-4 say how far one answer's heat reaches and how hard it burns (28 and 1.3 read well); show_points draws each answer as a dot once the viewer zooms in; low_color and high_color are the two ends of the scale, as #rrggbb. Split a heat map with split_by and each value spreads its own heat in its own color from appearance.value_colors, and the legend names them - no scale colors are used then.",
    split_by: "{ field_id } of a second choice field (different from group_by) - required by grouped/stacked/heatmap types, optional on line, forbidden elsewhere.",
    pattern_by: "{ field_id } of a third choice field drawn as a texture inside each split color - grouped/stacked bar and column charts only. Usually null.",
    legend_by: "{ field_id } of a choice field - KPI cards only: lists the count per value under the number. Not with median, cumulative_sum, moving_average or occurrences.",
    display_fields: "occurrences only: array of up to 5 field ids whose answers label each counted value, joined with display_separator (e.g. [<name field>, <phone field>]). Empty: the counted value itself is the label.",
    same_fields: "occurrences only: array of up to 5 { field_id, value } conditions on OTHER fields. With a value (e.g. { field_id: <status field>, value: 'live' }) only records holding that value are counted. With value null ('the same status, whatever it is') two records count together only when they share that field's value, and the shared value is appended to each label. Combine freely: [{ field_id: <status>, value: 'live' }, { field_id: <gender>, value: null }] counts repeated ids among live records, separately per gender.",
    display_separator: "occurrences only: the text placed between the display_fields answers of one label, up to 10 characters - ' - ' by default; ', ' or ' / ' are common choices.",
    occurrence_rule: "occurrences only: { operator, value } or null. operator is one of gt (more than), gte (at least), eq (exactly), lte (at most), lt (fewer than); value is the number of occurrences compared against. null applies no threshold.",
    occurrence_scope: "occurrences only: 'matching' shows only the values whose count meets occurrence_rule; 'all' shows every value and marks the ones that meet it. Ignored without a rule.",
    x_field_id: "Numeric field on the x axis - scatter and bubble only, otherwise null.",
    y_field_id: "Numeric field on the y axis - scatter and bubble only, otherwise null.",
    size_field_id: "Numeric field sizing the bubbles - bubble only, otherwise null.",
    filters: "Array (max 10) of { field_id, operator, value } restricting the submissions counted: operator is one of the filter_operators; value is a stored answer value (a string or number). Use [{ field_id: <choice field>, operator: 'eq', value: <one answer> }] to make one card per answer value.",
    period: "{ preset, from, to } - the widget's own time window; preset is one of the period_presets. Use { preset: 'all', from: null, to: null } unless a fixed window is wanted; the dashboard's period filter overrides it while viewing.",
    sort: "value_desc | value_asc | label_asc (category charts).",
    limit: `Max categories shown, 1-50 (default 12; pie/donut/waffle are capped at 6; treemap commonly 50).`,
    size: "small | medium | large - GRID BOARDS ONLY (a studio board ignores it and reads box.spot). The share of a board row this widget claims, so neighbours that still fit sit beside it: small is a third of a row (three small charts side by side), medium a half (two side by side), large a whole row to itself. A small and a medium therefore share one row. KPI cards ignore it - they have their own dense row of their own.",
    position: "0-based order on the board; assigned from the array order when missing. Ignored on a STUDIO board, where box.spot places every widget instead.",
    parent_id:
      "Optional: the id of a CANVAS widget on this same dashboard, when this widget should be drawn inside that canvas instead of on the board. null (or left out) for everything else. Only a canvas can hold widgets; the canvas must be in the same list; a widget cannot name itself; canvases may be nested at most 3 deep and never in a circle.",
    box:
      "Only meaningful with parent_id: how this widget lays itself out inside its canvas. { flow, width, height, min_width, max_width, min_height, max_height }. " +
      "flow is \"row\" (carry on along the row), \"row_break\" (start a new row) or \"column\" (take a line of its own). " +
      "Every length is { value, unit } with unit \"px\" or \"%\" - a percent is of the canvas, a pixel count is absolute, and percentages are capped at 100. " +
      "On a FREE canvas the lengths are ignored and box.spot places the widget instead: { x, y, w, h, z } in whole pixels from the section top left, w at least 80 and h at least 60, z deciding what sits above what. Leave spot out and it is dealt into a staircase from the corner. " +
      "LEAVE OUT what you do not care about: a widget with no width takes whatever is left of its row, which is usually what is wanted. A sensible pair of widgets side by side is two boxes of { flow: \"row\", width: { value: 50, unit: \"%\" } }; give the first one min_width so they stack rather than crush on a phone.",
    canvas:
      "Canvases only: { flow, gap, size_mode, width, height, min_width, max_width, min_height, max_height }. flow is how it arranges what is in it: \"row\" (along the row, wrapping), \"column\" (stacked), or \"free\" (NOT ARRANGED AT ALL - every widget sits exactly where it was dragged, at the x, y, w and h in its box.spot, and the others pass straight across it). gap is the pixels between them in row and column (0-64, 12 reads well) and means nothing on a free one. PREFER row or column: they look after themselves as a screen narrows, and free does not - reach for free only when the arrangement is the point. " +
      "A canvas is NOT sized by the board's small / medium / large - it is a band of the page, so ignore the size key on it. It is sized ONE OF TWO WAYS, never both at once, and size_mode says which: \"fixed\" reads width and height, \"range\" reads min_width / max_width / min_height / max_height and ignores the fixed pair. Leaving size_mode out means \"fixed\". " +
      "Every length is { value, unit } or null. unit is \"px\", \"%\", or - for width and height only - \"rest\", which means TAKE WHATEVER ROOM IS LEFT on the row and give it back when the widgets beside it grow; a \"rest\" length carries no number, so write { value: 0, unit: \"rest\" }. A percent on a canvas at the top of the board is a percent OF THE SCREEN (100% height is a screenful); inside another canvas it is a percent of that canvas. Width null gives it the full board, height null lets it grow to what it holds, and both are usually right. " +
      "There is no place key: a section is not put \"left\" or \"centred\" from a list. It takes a line of its own in the board order, at the size it was given, and what is INSIDE it is placed by dragging.",
    over_time:
      "Optional, and the way to ask a question about CHANGE rather than about totals: { enabled: true, field_id, granularity, axis }. null (or left out) on every widget that is read all at once. " +
      "It is not a chart type - it is a way of reading one. The widget keeps its formula, its filters and its split_by, and the time line takes over the axis its categories had, so \"average age by district\" turned over time becomes \"average age per month\", and with a split_by, one line or one stack per value of that field. Whatever the widget grouped by is set aside while it is on. " +
      "field_id is the clock: \"submitted_at\" (when the record arrived), \"updated_at\" (when it was last changed) or the id of a date / date_time field of the form - never a choice field. " +
      "granularity is \"auto\" (recommended) or one of hour, day, week, month, year. On auto the server picks it from the period actually being shown - a day reads in hours, up to a month in days, up to six months in weeks, up to two years in months, longer in years - so a custom range gets whatever suits its own length and the widget stays right when the reader changes the period. " +
      "axis is \"x\" for the time line along the bottom (the default) or \"y\" for it down the side; asking for y draws the widget as its horizontal twin, because which axis time runs along IS the difference between a column chart and a bar chart. " +
      "Only these chart types can carry it: line, area, bar, column, lollipop, dot_plot, grouped_column, stacked_column, stacked_100, grouped_bar, stacked_bar, stacked_bar_100. A pie, donut, waffle, treemap, heatmap, map, scatter, bubble or kpi divides one whole between its values or spends both axes already, and is refused. " +
      "Prefer over_time on a widget the reader will want a trend for, and do NOT also set group_by to a date field on the same widget - that is the same request made twice.",
    icon: "KPI cards only, optional: '<library>:<IconName>' from icon_libraries, e.g. 'lucide:Users' or 'tabler:IconChartBar'. An icon its library does not carry is looked up by the same name in the others, so a near-miss still draws something rather than nothing - but name it correctly. null otherwise.",
    appearance:
      "Optional look: { theme: 'light'|'dark', legend_position: 'bottom'|'top'|'right'|'left', light: { background, text, number, border }, dark: { background, text, number, border }, value_colors: { '<answer value>': '#rrggbb' }, value_labels: { '<answer value>': 'Shown as' } } - null for the default look. " +
      "unit is what the numbers are measured in: { text, at } with at \"start\" or \"end\". Spacing is handled for you - a unit at the start is joined to the digits (\"$100k\") and one at the end is given exactly one space (\"100k Rwf\") whatever spacing you write around it - so just give the word or symbol. It reaches every number the widget prints, not only the big one on a KPI card. " +
      "compact shortens long numbers: 1,200 reads as 1.2k, 4,000,000 as 4m, then bn, tn, qd, qt, sx, sp, og, nn, dc. It is ON unless you set compact: false, and you should leave it on - a board is read at a glance. Turn it off only where exact figures are the point, such as a reference table of amounts. " +
      "Colors are a six-digit hex, or EIGHT digits when the background should be see-through ('#1e2a3580' is half-transparent, '#00000000' invisible) so the board shows through the card - only background takes an alpha, text, number, border and value_colors stay solid. " +
      "border is the card's own outline color, and border_width how heavy it is in pixels - 2 is the default and 0 means NO OUTLINE AT ALL, which is what a widget inside a section usually wants so the section reads as one surface. " +
      "legend_position is obeyed on every widget at every card size, so 'right' really does put the legend beside the chart, the map or the ring on a small card too - do not set it to a side unless the widget's legend is short enough to read in a narrow column. " +
      "value_colors applies to every widget that draws one mark per value, treemap tiles included. " +
      "value_labels only changes what a value is CALLED in this widget's legend, labels and tooltips; the stored answer is untouched, so filters and shared links still use the real value.",
  };
}

function chart_types_doc() {
  const doc = {};
  CHART_CATALOG.forEach((entry) => {
    const rules = type_rules(entry.type);
    doc[entry.type] = {
      kind: entry.kind,
      needs: entry.kind === "kpi" ? "metric only (plus optional legend_by, icon)" : entry.kind === "point" ? "x_field_id and y_field_id (numeric)" + (entry.type === "bubble" ? ", size_field_id (numeric)" : "") : entry.kind === "time" ? "metric and group_by { field_id: 'submitted_at' or a date field, granularity }" : "metric; group_by (a choice field) is optional",
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
      "Choose the chart by the data: a choice field alone -> column/bar/donut/pie/lollipop/treemap; two choice fields -> stacked_column/grouped_column/stacked_100/heatmap; a date or the submission date -> line/area; two numeric fields -> scatter (three -> bubble); a single figure -> kpi.",
      "To show a measure for each value of a field, prefer ONE widget that carries the values inside it - a KPI card with legend_by, or a chart with that field as group_by or split_by - over one filtered widget per value (see one_widget_or_many).",
      "A board answers two different questions: how much there is now, and how it is changing. Cover both - leave most widgets as they are, and turn a few of the ones a reader will want a trend for over time (see over_time), rather than adding a second widget that repeats the first with a date on its axis.",
      "Set each chart's size to the share of a row it deserves: small (a third), medium (a half) or large (a whole row). Neighbours that still fit share the row, so a row of three small charts or one large chart alone both work.",
      "Category charts need a choice field in group_by; numeric formulas (sum, avg, min, max, stddev, median, cumulative_sum, moving_average) need a numeric field in metric.field_id; count may leave field_id null to count submissions.",
      "Titles are plain language for the readers of the board (e.g. 'Submissions per district'); keep them under 120 characters and unique.",
      `A dashboard holds at most ${MAX_WIDGETS} widgets in total, including the ones already on the board when adding.`,
      "The server validates every widget against the form; an invalid widget list is refused as a whole with the first violation shown, so follow the rules exactly.",
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
    filter_operators: { eq: "equals", ne: "does not equal", contains: "text contains", gt: "greater than (numbers)", gte: "greater or equal (numbers)", lt: "less than (numbers)", lte: "less or equal (numbers)" },
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
    const filters = Array.isArray(source.filters) ? source.filters : [];
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
