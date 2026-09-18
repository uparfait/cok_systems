/**
 * How a widget lays itself out INSIDE a canvas.
 *
 * A canvas is free space: what goes in it is placed by its own box rather
 * than by the board's grid. A box says which way the widget joins the flow
 * - along the row, starting a fresh row, or stacked in a column - and how
 * big it is allowed to be, in pixels or in percent of the canvas.
 *
 * Every length is optional. What is left out is decided by what the widget
 * holds and by the room the canvas has, which is what makes a canvas
 * usable before anything has been measured: drop a widget in and it sits
 * somewhere sensible, then size it when you care.
 */

export const FLOWS = ["row", "row_break", "column"];
export const UNITS = ["px", "%"];
export const LENGTH_KEYS = ["width", "height", "min_width", "max_width", "min_height", "max_height"];

/** The default a widget gets the moment it is dropped into a canvas. */
export const default_box = () => ({ flow: "row", width: { value: 50, unit: "%" }, min_width: { value: 220, unit: "px" } });

/** "50%" / "320px", or "" when the length was never set. */
export function css_length(length) {
  if (!length || typeof length !== "object") return "";
  const value = Number(length.value);
  if (!Number.isFinite(value) || value <= 0) return "";
  return `${value}${length.unit === "%" ? "%" : "px"}`;
}

const or_undefined = (text) => (text === "" ? undefined : text);

/**
 * One child's style inside a canvas laid out as flex-wrap.
 *
 * A percent width is turned into flex-basis rather than width, because a
 * flex child's width is what it is ASKED to be and its basis is what it is
 * given - only the basis shares a row correctly once gaps are taken out.
 * A widget with no width of its own grows to fill what is left of its row,
 * so a canvas is never left with a bare strip down one side.
 */
export function child_style(box, gap) {
  const settings = box || {};
  const width = css_length(settings.width);
  const style = {
    minWidth: or_undefined(css_length(settings.min_width)),
    maxWidth: or_undefined(css_length(settings.max_width)),
    minHeight: or_undefined(css_length(settings.min_height)),
    maxHeight: or_undefined(css_length(settings.max_height)),
    height: or_undefined(css_length(settings.height)),
  };
  if (settings.flow === "column") {
    // A column child takes the whole width it is given and stacks.
    style.flexBasis = "100%";
    style.flexGrow = 0;
    return style;
  }
  if (width.endsWith("%")) {
    // Its share of the row, less its share of the gap between them.
    style.flexBasis = `calc(${width} - ${Math.round((Number(gap) || 0) / 2)}px)`;
    style.flexGrow = 0;
  } else if (width) {
    style.flexBasis = width;
    style.flexGrow = 0;
  } else {
    style.flexBasis = 0;
    style.flexGrow = 1;
  }
  return style;
}

/**
 * Whether a child forces the row to break before it. A widget set to
 * "row_break" starts a new line however much room was left on the last
 * one, and so does the first child after a column.
 */
export const breaks_row = (box) => !!box && (box.flow === "row_break" || box.flow === "column");

/** The canvas's own style: the direction its children run, and the room between them. */
export function canvas_style(canvas) {
  const settings = canvas || {};
  const gap = Number.isFinite(Number(settings.gap)) ? Number(settings.gap) : 12;
  return {
    display: "flex",
    flexWrap: "wrap",
    flexDirection: settings.flow === "column" ? "column" : "row",
    alignItems: "stretch",
    alignContent: "flex-start",
    gap,
    height: or_undefined(css_length(settings.height)),
    minHeight: settings.height ? undefined : 120,
  };
}

/**
 * A dragged edge turned back into a length. Dragging is only ever allowed
 * to set a size, never to remove one, and never below what can be seen.
 */
export function resized_length(start_px, delta_px, container_px, unit) {
  const next = Math.max(60, Math.round(start_px + delta_px));
  if (unit !== "%") return { value: next, unit: "px" };
  const room = Number(container_px) > 0 ? Number(container_px) : next;
  return { value: Math.max(5, Math.min(100, Math.round((next / room) * 1000) / 10)), unit: "%" };
}
