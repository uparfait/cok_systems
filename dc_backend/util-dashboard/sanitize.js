/**
 * Reduces incoming widget payloads to exactly the keys the dashboard
 * understands - anything else a client sends is dropped before validation
 * and storage, so no stray data can ever be persisted or executed.
 */

const { MAP_LEVELS, TIME_SOURCE_FIELDS, OVER_TIME_AXES, BOX_FLOWS, CANVAS_FLOWS, BOARD_MODES, BOARD_WIDTH, BOX_UNITS, BOX_SIZE_MODES, CANVAS_UNITS } = require("./constants.js");
const { sanitize_period, sanitize_pinned_fields, sanitize_text, sanitize_table } = require("./sanitize_extras.js");

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
/**
 * A BOARD'S OWN LAYOUT: the grid it has always used, or studio, where the
 * widgets are placed and sized by hand.
 *
 * A studio board keeps the WIDTH it was arranged at, because that is the
 * only thing that makes pixel placement survive a different screen: a
 * narrower one scales the whole board down by the ratio between the two,
 * so the design arrives intact rather than reflowed into something else.
 */
function sanitize_board_layout(raw) {
  if (!raw || typeof raw !== "object") return null;
  const width = Number(raw.width);
  return {
    mode: BOARD_MODES.includes(clean_string(raw.mode)) ? clean_string(raw.mode) : "grid",
    width: Number.isFinite(width) ? Math.min(Math.max(Math.round(width), BOARD_WIDTH.least), BOARD_WIDTH.most) : BOARD_WIDTH.usual,
  };
}

function sanitize_appearance(appearance) {
  if (!appearance || typeof appearance !== "object") return null;
  const out = { theme: appearance.theme === "dark" ? "dark" : "light" };
  if (LEGEND_POSITIONS.includes(appearance.legend_position)) out.legend_position = appearance.legend_position;
  // What the widget's numbers are measured in, and which side it goes.
  // Kept exactly as typed, spaces and all: "$" wants none after it and
  // " RWF" wants one before it, and only the author knows which.
  // Long numbers are shortened (1.2k, 4m, 1.2bn) unless turned off.
  if (appearance.compact === false) out.compact = false;
  // How heavy the card outlines itself, in pixels. Zero is no outline at
  // all; only a width that is not the usual two is worth storing.
  const border_width = Number(appearance.border_width);
  if (Number.isFinite(border_width) && border_width >= 0 && border_width !== 2) out.border_width = Math.min(Math.round(border_width), 8);
  if (appearance.unit && typeof appearance.unit === "object") {
    const text = typeof appearance.unit.text === "string" ? appearance.unit.text.slice(0, 12) : "";
    if (text.trim()) out.unit = { text, at: appearance.unit.at === "start" ? "start" : "end" };
  }
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

const GRANULARITIES = ["auto", "hour", "day", "week", "month", "year"];

/**
 * "Over time": the clock a widget is read against, how finely it is
 * sliced, and which way the time line runs. Left out entirely when the
 * toggle is off, so a widget that is not over time carries nothing.
 */
function sanitize_over_time(widget) {
  const raw = widget.over_time && typeof widget.over_time === "object" ? widget.over_time : null;
  if (!raw || raw.enabled !== true) return null;
  const field_id = clean_string(raw.field_id) || TIME_SOURCE_FIELDS[0];
  const out = { enabled: true, field_id };
  out.granularity = GRANULARITIES.includes(clean_string(raw.granularity)) ? clean_string(raw.granularity) : "auto";
  out.axis = OVER_TIME_AXES.includes(clean_string(raw.axis)) ? clean_string(raw.axis) : "x";
  return out;
}

/** One length: a number and what it is measured in, or nothing. */
const BOX_LENGTH_KEYS = ["width", "height", "min_width", "max_width", "min_height", "max_height"];

/**
 * A canvas's own length, which may also be "the rest". The rest carries no
 * number - the room it is left decides - so it is stored as a unit with a
 * zero beside it rather than as a size somebody could edit into nonsense.
 */
function sanitize_canvas_length(value) {
  if (value && typeof value === "object" && clean_string(value.unit) === "rest") return { value: 0, unit: "rest" };
  return sanitize_length(value);
}

function sanitize_length(value) {
  if (!value || typeof value !== "object") return null;
  const size = Number(value.value);
  if (!Number.isFinite(size) || size <= 0) return null;
  const unit = BOX_UNITS.includes(clean_string(value.unit)) ? clean_string(value.unit) : "px";
  // A percentage past the whole canvas, or a pixel size past any screen,
  // is a typo rather than an intention.
  const cap = unit === "%" ? 100 : 4000;
  return { value: Math.min(Math.round(size * 100) / 100, cap), unit };
}

const BOX_LENGTHS = ["width", "height", "min_width", "max_width", "min_height", "max_height"];

/**
 * How a widget lays itself out INSIDE a canvas: whether it runs along the
 * row, starts a new one, or stacks in a column, and the sizes it is held
 * to. Every length is optional - what is left out is decided by the canvas
 * and by what the widget holds. Only ever kept on a widget that sits in a
 * canvas; a widget on the board itself is laid out by the board.
 */
function sanitize_box(widget) {
  const raw = widget.box && typeof widget.box === "object" ? widget.box : null;
  if (!raw) return null;
  const out = { flow: BOX_FLOWS.includes(clean_string(raw.flow)) ? clean_string(raw.flow) : "row" };
  BOX_LENGTHS.forEach((key) => {
    const length = sanitize_length(raw[key]);
    if (length) out[key] = length;
  });
  // Where it was dragged to, when the section it is in places rather than
  // queues. Pixels from the section's top left, capped at a size no screen
  // will ever need so a bad number cannot stretch a board to nothing.
  const spot = raw.spot && typeof raw.spot === "object" ? raw.spot : null;
  if (spot) {
    const whole = (value, least, most, spare) => {
      const held = Number(value);
      return Number.isFinite(held) ? Math.min(Math.max(Math.round(held), least), most) : spare;
    };
    out.spot = {
      x: whole(spot.x, 0, 20000, 0),
      y: whole(spot.y, 0, 20000, 0),
      w: whole(spot.w, 80, 8000, 320),
      h: whole(spot.h, 60, 8000, 220),
      z: whole(spot.z, 0, 9999, 1),
    };
  }
  return out;
}

/** A canvas's own settings: which way its children run, and how far apart. */
function sanitize_canvas(widget) {
  if (clean_string(widget.chart_type) !== "canvas") return null;
  const raw = widget.canvas && typeof widget.canvas === "object" ? widget.canvas : {};
  const gap = Number(raw.gap);
  const settings = {
    // A canvas arranges along rows, down a column, or not at all.
    flow: CANVAS_FLOWS.includes(clean_string(raw.flow)) ? clean_string(raw.flow) : "row",
    gap: Number.isFinite(gap) && gap >= 0 && gap <= 64 ? Math.round(gap) : 12,
    // A section is sized in width and height rather than by the board's
    // small / medium / large: it is a band of the page, not a card. It
    // takes the same six lengths a widget inside a canvas takes, so a
    // least and a most can be set for each, in pixels or in percent.
  };
  // Anything not set stays null: the board then gives it the full width
  // and lets it grow to whatever it holds. Both sets are kept whichever
  // mode is on, so switching back and forth does not throw a size away.
  settings.size_mode = BOX_SIZE_MODES.includes(clean_string(raw.size_mode)) ? clean_string(raw.size_mode) : "fixed";
  BOX_LENGTH_KEYS.forEach((key) => {
    settings[key] = key === "width" || key === "height" ? sanitize_canvas_length(raw[key]) : sanitize_length(raw[key]);
  });
  return settings;
}

function sanitize_widget(widget) {
  if (!widget || typeof widget !== "object") return null;
  const group_by = sanitize_field_ref(widget.group_by);
  if (group_by && widget.group_by && typeof widget.group_by.granularity === "string") {
    group_by.granularity = widget.group_by.granularity;
  }
  // The widget's own window - and whether it is LOCKED to it, in which
  // case the board's date filter passes this widget by.
  const period = sanitize_period(widget.period);
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
    // The same widget, read as the period passes instead of all at once.
    over_time: sanitize_over_time(widget),
    // The canvas this widget sits in, and how it lays itself out there.
    parent_id: clean_string(widget.parent_id) || null,
    box: sanitize_box(widget),
    // Canvases only: how the widgets inside them are arranged.
    canvas: sanitize_canvas(widget),
    // Text blocks only: the words, and how they are set.
    text: sanitize_text(widget),
    // Tables only: the records shown or the summary computed.
    table: sanitize_table(widget),
    // The board filter fields this widget does not follow.
    pinned_fields: sanitize_pinned_fields(widget.pinned_fields),
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
    period,
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
  sanitize_board_layout,
  sanitize_widget,
  sanitize_widgets,
  sanitize_period_override,
};
