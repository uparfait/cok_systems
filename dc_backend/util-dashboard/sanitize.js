/**
 * Reduces incoming widget payloads to exactly the keys the dashboard
 * understands - anything else a client sends is dropped before validation
 * and storage, so no stray data can ever be persisted or executed.
 */

const { MAP_LEVELS } = require("./constants.js");

function clean_string(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitize_field_ref(value) {
  if (!value || typeof value !== "object" || typeof value.field_id !== "string" || !value.field_id.trim()) return null;
  return { field_id: value.field_id.trim() };
}

// Six digits, or eight when the color carries transparency with it.
const HEX_COLOR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const MODE_COLOR_KEYS = ["background", "text", "number", "border"];
const MAX_VALUE_COLORS = 100;
const LEGEND_POSITIONS = ["bottom", "top", "right", "left"];

function sanitize_mode(mode) {
  if (!mode || typeof mode !== "object") return null;
  const out = {};
  MODE_COLOR_KEYS.forEach((key) => {
    if (typeof mode[key] === "string" && HEX_COLOR.test(mode[key].trim())) out[key] = mode[key].trim().toLowerCase();
  });
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * A widget's look: its mode, the colors of each mode (background - which
 * may be see-through - text, numbers and border) and one color per legend
 * / category value. Every color must be a six- or eight-digit hex.
 */
function sanitize_appearance(appearance) {
  if (!appearance || typeof appearance !== "object") return null;
  const out = { theme: appearance.theme === "dark" ? "dark" : "light" };
  if (LEGEND_POSITIONS.includes(appearance.legend_position)) out.legend_position = appearance.legend_position;
  const light = sanitize_mode(appearance.light);
  const dark = sanitize_mode(appearance.dark);
  if (light) out.light = light;
  if (dark) out.dark = dark;
  if (appearance.value_labels && typeof appearance.value_labels === "object") {
    const value_labels = {};
    Object.keys(appearance.value_labels)
      .slice(0, 200)
      .forEach((key) => {
        const name = appearance.value_labels[key];
        if (key.length <= 120 && typeof name === "string" && name.trim()) value_labels[key] = name.trim().slice(0, 120);
      });
    if (Object.keys(value_labels).length > 0) out.value_labels = value_labels;
  }
  if (appearance.value_colors && typeof appearance.value_colors === "object") {
    const value_colors = {};
    Object.keys(appearance.value_colors)
      .slice(0, MAX_VALUE_COLORS)
      .forEach((key) => {
        const color = appearance.value_colors[key];
        if (key.length <= 120 && typeof color === "string" && HEX_COLOR.test(color.trim())) value_colors[key] = color.trim().toLowerCase();
      });
    if (Object.keys(value_colors).length > 0) out.value_colors = value_colors;
  }
  return out;
}

/** A map widget's own settings: which administrative level it draws, and its markers. */
// A map is drawn one of two ways, and they share almost nothing: a WORLD
// map fills administrative boundaries by name, a HEAT map spreads the
// positions records were collected at. Each keeps only its own settings.
const MAP_MODES = ["world", "heat"];

const clean_color = (value) => (HEX_COLOR.test(clean_string(value)) ? clean_string(value).toLowerCase() : "");

function sanitize_map(widget) {
  const raw = widget.map && typeof widget.map === "object" ? widget.map : {};
  const marker = clean_string(raw.marker);
  const mode = MAP_MODES.includes(clean_string(raw.mode)) ? clean_string(raw.mode) : "world";
  const out = { mode };
  if (mode === "heat") {
    if (clean_string(raw.point_field_id)) out.point_field_id = clean_string(raw.point_field_id);
    if (clean_string(raw.weight_field_id)) out.weight_field_id = clean_string(raw.weight_field_id);
    const radius = Number(raw.radius);
    const intensity = Number(raw.intensity);
    if (Number.isFinite(radius) && radius >= 6 && radius <= 80) out.radius = Math.round(radius);
    if (Number.isFinite(intensity) && intensity >= 0.2 && intensity <= 4) out.intensity = Number(intensity.toFixed(2));
    if (raw.show_points === true) out.show_points = true;
    // The two ends of the heat scale, which the widget may set itself.
    if (clean_color(raw.low_color)) out.low_color = clean_color(raw.low_color);
    if (clean_color(raw.high_color)) out.high_color = clean_color(raw.high_color);
    return out;
  }
  if (MAP_LEVELS.includes(clean_string(raw.level))) out.level = clean_string(raw.level);
  if (marker) out.marker = marker;
  if (raw.show_labels === false) out.show_labels = false;
  if (raw.show_markers === true) out.show_markers = true;
  return out;
}

function sanitize_widget(widget) {
  if (!widget || typeof widget !== "object") return null;
  const group_by = sanitize_field_ref(widget.group_by);
  if (group_by && widget.group_by && typeof widget.group_by.granularity === "string") {
    group_by.granularity = widget.group_by.granularity;
  }
  const period =
    widget.period && typeof widget.period === "object"
      ? {
          preset: clean_string(widget.period.preset),
          from: clean_string(widget.period.from) || null,
          to: clean_string(widget.period.to) || null,
        }
      : null;
  return {
    id: clean_string(widget.id),
    title: clean_string(widget.title),
    description: clean_string(widget.description) || null,
    // A KPI card's optional icon, stored as "<library>:<icon name>".
    icon: clean_string(widget.icon) || null,
    appearance: sanitize_appearance(widget.appearance),
    form_group_id: clean_string(widget.form_group_id),
    chart_type: clean_string(widget.chart_type),
    metric: {
      aggregation: clean_string(widget.metric && widget.metric.aggregation) || "count",
      field_id: clean_string(widget.metric && widget.metric.field_id) || null,
    },
    group_by,
    split_by: sanitize_field_ref(widget.split_by),
    // KPI cards only: the choice field whose per-value counts are listed
    // under the number as a legend.
    legend_by: sanitize_field_ref(widget.legend_by),
    // Split charts only: a third choice field drawn as a pattern inside
    // each split segment's color.
    pattern_by: sanitize_field_ref(widget.pattern_by),
    // "Count occurrences" only: the fields whose values label each counted
    // value (joined with " - "), the count threshold, and whether only the
    // values meeting it are shown.
    display_fields: Array.isArray(widget.display_fields)
      ? widget.display_fields.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim()).slice(0, 5)
      : [],
    // Kept untrimmed: a separator is usually spaces around a dash.
    display_separator: typeof widget.display_separator === "string" ? widget.display_separator.slice(0, 10) : " - ",
    // "Count occurrences" only: the fields whose value must be shared for
    // two records to count together - any shared value, or one fixed value.
    same_fields: Array.isArray(widget.same_fields)
      ? widget.same_fields
          .filter((entry) => entry && typeof entry === "object" && typeof entry.field_id === "string" && entry.field_id.trim())
          .map((entry) => ({ field_id: entry.field_id.trim(), value: ["string", "number", "boolean"].includes(typeof entry.value) && String(entry.value).trim() !== "" ? entry.value : null }))
          .slice(0, 5)
      : [],
    occurrence_rule:
      widget.occurrence_rule && typeof widget.occurrence_rule === "object" && clean_string(widget.occurrence_rule.operator)
        ? { operator: clean_string(widget.occurrence_rule.operator), value: Number(widget.occurrence_rule.value) }
        : null,
    occurrence_scope: clean_string(widget.occurrence_scope) || undefined,
    // Maps only: the administrative level drawn and how it is marked.
    map: sanitize_map(widget),
    x_field_id: clean_string(widget.x_field_id) || null,
    y_field_id: clean_string(widget.y_field_id) || null,
    size_field_id: clean_string(widget.size_field_id) || null,
    filters: Array.isArray(widget.filters)
      ? widget.filters
          .filter((filter) => filter && typeof filter === "object")
          .map((filter) => ({
            field_id: clean_string(filter.field_id),
            operator: clean_string(filter.operator),
            value: ["string", "number", "boolean"].includes(typeof filter.value) ? filter.value : "",
          }))
      : [],
    period: period && period.preset ? period : null,
    sort: widget.sort === undefined ? undefined : clean_string(widget.sort),
    limit: widget.limit === undefined ? undefined : Number(widget.limit),
    size: widget.size === undefined ? undefined : clean_string(widget.size),
    position: Number.isInteger(widget.position) ? widget.position : 0,
  };
}

function sanitize_widgets(widgets) {
  if (!Array.isArray(widgets)) return [];
  return widgets.map((widget) => sanitize_widget(widget)).filter((widget) => widget !== null);
}

/**
 * The dashboard-level period override of a data request.
 */
function sanitize_period_override(period) {
  if (!period || typeof period !== "object" || !clean_string(period.preset)) return null;
  return {
    preset: clean_string(period.preset),
    from: clean_string(period.from) || null,
    to: clean_string(period.to) || null,
  };
}

module.exports = {
  sanitize_widget,
  sanitize_widgets,
  sanitize_period_override,
};
