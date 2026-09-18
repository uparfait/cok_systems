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
/**
 * How a CANVAS arranges what is in it. The first two queue its widgets up -
 * along the row or down the column - and the third does not arrange them
 * at all: FREE puts every widget exactly where it was dragged and lets the
 * others pass straight across it. Free is a design surface; the other two
 * are layouts that look after themselves as a screen narrows, so free is
 * the one to reach for last.
 */
export const CANVAS_FLOWS = ["row", "column", "free"];

/**
 * A whole BOARD is arranged one of two ways: the responsive GRID it has
 * always used, where widgets claim a share of a row and reflow to fit, or
 * STUDIO, where every widget is placed and sized by hand and stacked in
 * whatever order the author wants.
 *
 * A studio board remembers the width it was arranged at, because pixels
 * are not the same on every screen: a narrower one scales the whole board
 * down by the ratio between the two rather than reflowing it, so a design
 * survives the trip to a phone.
 */
export const BOARD_MODES = ["grid", "studio"];
export const BOARD_WIDTH = { least: 320, most: 4000, usual: 1280, min_height: 480 };
export const is_studio = (layout) => !!layout && layout.mode === "studio";
export function board_width(layout) {
  const held = Number(layout && layout.width);
  if (!Number.isFinite(held)) return BOARD_WIDTH.usual;
  return Math.min(Math.max(Math.round(held), BOARD_WIDTH.least), BOARD_WIDTH.most);
}
/** What a board becomes the moment studio mode is turned on. */
export const studio_layout = (width) => ({ mode: "studio", width: board_width({ width }) });
export const is_free = (canvas) => !!canvas && canvas.flow === "free";
/** The room left below the lowest widget on a free surface. */
export const FREE_PAD = 16;

/**
 * Where one widget sits on a free surface, in pixels from the section's
 * top left. A widget that has never been dragged is dealt out in a
 * staircase from the corner, so a handful dropped in at once arrive
 * readable and apart rather than in one pile.
 */
export function spot_of(box, index) {
  const held = box && typeof box.spot === "object" && box.spot ? box.spot : null;
  const step = Number(index) > 0 ? Number(index) : 0;
  const fallback = { x: 16 + (step % 3) * 28, y: 16 + Math.floor(step / 3) * 28, w: 320, h: 220, z: step + 1 };
  if (!held) return fallback;
  const number = (value, spare) => (Number.isFinite(Number(value)) ? Number(value) : spare);
  return {
    x: Math.max(0, number(held.x, fallback.x)),
    y: Math.max(0, number(held.y, fallback.y)),
    w: Math.max(80, number(held.w, fallback.w)),
    h: Math.max(60, number(held.h, fallback.h)),
    z: number(held.z, fallback.z),
  };
}
export const UNITS = ["px", "%"];
/**
 * A canvas has a third answer to "how wide": THE REST. A section set to
 * the rest takes whatever room the widgets beside it have not claimed and
 * gives it back when they grow, which is the only way to say "fill what is
 * left" without knowing what else is on the row. It carries no number -
 * the room decides - so the box beside the unit is left alone.
 */
export const CANVAS_UNITS = ["px", "%", "rest"];
export const REST = { value: 0, unit: "rest" };
export const is_rest = (length) => !!length && typeof length === "object" && length.unit === "rest";
export const LENGTH_KEYS = ["width", "height", "min_width", "max_width", "min_height", "max_height"];

/**
 * HOW a canvas is sized: to a fixed width and height, or to a least and a
 * most with the page filling whatever is between them. The two are offered
 * one at a time rather than together, because a fixed width and a
 * least-width in the same box is a question nobody can answer by looking
 * at it - the fixed one simply wins and the other sits there lying.
 */
export const SIZE_MODES = ["fixed", "range"];
export const FIXED_KEYS = ["width", "height"];
export const RANGE_KEYS = ["min_width", "max_width", "min_height", "max_height"];
export const canvas_size_mode = (canvas) => (canvas && canvas.size_mode === "range" ? "range" : "fixed");
export const canvas_length_keys = (canvas) => (canvas_size_mode(canvas) === "range" ? RANGE_KEYS : FIXED_KEYS);

/** The default a widget gets the moment it is dropped into a canvas. */
export const default_box = () => ({ flow: "row", width: { value: 50, unit: "%" }, min_width: { value: 220, unit: "px" } });

/** "50%" / "320px", or "" when the length was never set or is "the rest". */
export function css_length(length) {
  if (!length || typeof length !== "object" || length.unit === "rest") return "";
  const value = Number(length.value);
  if (!Number.isFinite(value) || value <= 0) return "";
  return `${value}${length.unit === "%" ? "%" : "px"}`;
}

const or_undefined = (text) => (text === "" ? undefined : text);

/**
 * A canvas's OWN size on the board.
 *
 * A canvas is not small, medium or large - it is a piece of the page's
 * layout, so it is sized one of two ways, never both at once: to a FIXED
 * width and height, or to a RANGE, a least and a most for each, with the
 * page filling whatever is between. Every length is optional and every one
 * may be in pixels or in percent. Left alone, a canvas takes the width of
 * the board and grows to what it holds.
 *
 * A percent is a percent of whatever HOLDS the section: the whole
 * dashboard at the top, the parent section inside another. 100% is the
 * full width of the one or the other, which is what a person means.
 */
/**
 * The flex plumbing behind "the rest": across the row a section set to the
 * rest grows into what is left, and down the page it stretches to the
 * height of whatever it is beside. Nothing set means the section keeps the
 * size it was given.
 */
export function canvas_flex(canvas) {
  const settings = canvas || {};
  const style = {};
  if (canvas_size_mode(settings) === "range") return style;
  if (is_rest(settings.width)) {
    style.flexGrow = 1;
    style.flexBasis = 0;
    style.minWidth = 0;
  }
  if (is_rest(settings.height)) style.alignSelf = "stretch";
  return style;
}

/**
 * A percent on a canvas is a percent of WHAT HOLDS IT: the whole dashboard
 * for a section on the board, and the section itself for one inside
 * another. 100% therefore means the full width of the board, or the full
 * width of the parent section, which is what a person means when they type
 * it. Nothing here reads the window.
 */
export function canvas_frame(canvas) {
  const settings = canvas || {};
  const across = (length) => or_undefined(css_length(length));
  const down = (length) => or_undefined(css_length(length));
  if (canvas_size_mode(settings) === "range") {
    return {
      minWidth: across(settings.min_width) ? `min(${across(settings.min_width)}, 100%)` : undefined,
      maxWidth: across(settings.max_width),
      minHeight: down(settings.min_height),
      maxHeight: down(settings.max_height),
    };
  }
  // "The rest" is not a length at all: it is left out here and handed to
  // the flex plumbing instead, which is the only thing that knows what the
  // rest of the row came to.
  // Wider than the board it is on, a section is drawn at the board: the
  // width asked for is read as the smaller of it and the whole.
  const asked = is_rest(settings.width) ? undefined : across(settings.width);
  return {
    width: asked ? `min(${asked}, 100%)` : undefined,
    height: is_rest(settings.height) ? undefined : down(settings.height),
  };
}

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
  // A free surface arranges nothing: it is a box its widgets are placed on.
  if (is_free(settings)) return { position: "relative", height: "100%", minHeight: 160 };
  return {
    display: "flex",
    flexWrap: "wrap",
    flexDirection: settings.flow === "column" ? "column" : "row",
    alignItems: "stretch",
    alignContent: "flex-start",
    gap,
    // The canvas's own frame already carries its height on the board; here
    // the flex box only needs to fill it.
    height: "100%",
    minHeight: settings.height ? undefined : 120,
  };
}

/**
 * A dragged edge turned back into a length. Dragging is only ever allowed
 * to set a size, never to remove one, never below what can be seen - and,
 * when told to stay within, never past the room it is dragged inside of,
 * so a grip cannot pull a section out beyond the board's side.
 */
export function resized_length(start_px, delta_px, container_px, unit, within) {
  const grown = Math.max(60, Math.round(start_px + delta_px));
  const next = within && Number(container_px) > 0 ? Math.min(grown, Math.round(Number(container_px))) : grown;
  if (unit !== "%") return { value: next, unit: "px" };
  const room = Number(container_px) > 0 ? Number(container_px) : next;
  return { value: Math.max(5, Math.min(100, Math.round((next / room) * 1000) / 10)), unit: "%" };
}
