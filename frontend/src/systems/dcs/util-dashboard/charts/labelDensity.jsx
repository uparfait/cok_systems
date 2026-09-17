import React from "react";
import { text_width, fit_text, widest_word, x_axis_height, wrapped_tick, number_room } from "./chartLabels.jsx";

/**
 * What a category axis does when it is given more labels than it has room
 * for - fifty districts under a chart that is 320 pixels wide.
 *
 * There are three answers, and the axis takes the first one that still
 * reads, measured (see chartLabels) rather than guessed:
 *
 *   UPRIGHT  Every label's longest word fits the room one category gets,
 *            so labels wrap over as many lines as they need and nothing
 *            is turned or dropped. This is what a normal chart does, and
 *            what a chart that is allowed to widen and scroll always does.
 *   ANGLED   A name is wider than its column but a LINE of text still
 *            fits between one column and the next: labels lie over at 45
 *            degrees, where the room one needs is its line height, not its
 *            length. A name too long for the axis depth ends in "...", and
 *            the tooltip carries it in full.
 *   THINNED  Not even a turned line fits, so only every n-th label is
 *            drawn - the axis stays readable and evenly spaced instead of
 *            collapsing into a grey smear. Every mark is still there; the
 *            tooltip still names each one.
 *
 * The numbers written on the marks are thinned the same way, against their
 * own width: a column 7 pixels wide cannot carry "1,204", so every n-th
 * column carries its value and the rest are read from the tooltip.
 */

// Labels lie over at 45 degrees - the one angle where the horizontal and
// vertical room a label costs are the same, so an axis never suddenly
// needs twice its depth.
const ANGLE = 45;
const SIN = Math.SQRT1_2;
// The deepest an angled axis may cut into the chart, measured along the
// label. Past this a name is ended with "..." rather than eating the plot.
const MAX_DIAGONAL = 130;
// However tight the drawing is, a label is given at least this much of
// itself - below it there is nothing left to read anyway.
const MIN_ANGLED = 46;
// A line of text costs a little more than its font size.
const LINE = 1.35;

/**
 * How one category axis lays itself out, given the room ONE category gets.
 * Returns the angle (0 for upright), the Recharts `interval` that leaves
 * only every n-th label drawn, and the pixels of text room a label has.
 */
export function axis_plan(labels, per_px, font) {
  const size = font || 11;
  const list = (labels || []).map((label) => String(label === undefined || label === null ? "" : label));
  const room = Math.max(1, per_px);
  if (list.every((label) => widest_word(label, size) <= room)) return { angle: 0, interval: 0, step: 1, room };
  // Turned on its side a label is limited by the LINE it needs, not by its
  // length: one line is size*LINE tall, which at 45 degrees costs that
  // much divided by sin(45) of horizontal pitch.
  const pitch = Math.ceil((size * LINE) / SIN);
  const step = Math.max(1, Math.ceil(pitch / room));
  const longest = list.reduce((best, label) => Math.max(best, text_width(label, size)), 0);
  return { angle: ANGLE, interval: step - 1, step, room: Math.min(MAX_DIAGONAL, Math.ceil(longest)) };
}

/** One label lying over at 45 degrees, ending its tail with "..." if it must. */
export function AngledTick({ x, y, payload, fill, maxPx, fontSize }) {
  const size = fontSize || 11;
  const text = fit_text(payload && payload.value, maxPx, size);
  if (!text) return null;
  // The tick point itself is the label's right end, so it hangs back under
  // its own column instead of drifting off the one beside it.
  const top = y + size * 0.9;
  return (
    <text x={x} y={top} fill={fill} fontSize={size} textAnchor="end" transform={`rotate(-${ANGLE} ${x} ${top})`}>
      {text}
    </text>
  );
}

const angled_tick = (palette, max_px, font) => (props) => <AngledTick {...props} fill={palette.text} maxPx={max_px} fontSize={font} />;

/**
 * Everything an X axis needs to draw itself for these labels in this much
 * room per category: its plan, the height to reserve, and its tick.
 *
 * `left_px` is what lies between the left edge of the drawing and the
 * first category - the numeric axis, mostly. An angled label lies back
 * over that space, so it is also the furthest the FIRST label may reach
 * before the edge of the drawing cuts it, and no label is drawn longer
 * than that. Without it a long first name would simply disappear into the
 * margin, which is the one thing an axis may never do.
 */
export function category_axis(labels, per_px, font, palette, left_px) {
  const plan = axis_plan(labels, per_px, font);
  const size = font || 11;
  const reach = Math.max(MIN_ANGLED, ((left_px || 0) + Math.max(0, per_px) / 2) / SIN);
  const room = plan.angle ? Math.min(plan.room, Math.floor(reach)) : plan.room;
  const height = plan.angle ? Math.ceil(room * SIN) + size + 10 : x_axis_height(labels, room, size);
  const tick = plan.angle ? angled_tick(palette, room, size) : wrapped_tick(palette, room, "middle", size);
  return { ...plan, room, height, tick };
}

/** The field the thinned copy of a value is written to. */
export const VALUE_LABEL_KEY = "__shown_value";

/** One in how many marks can carry its number without the numbers touching. */
export const value_step = (values, per_px, font) => Math.max(1, Math.ceil((number_room(values, font) + 6) / Math.max(1, per_px)));

/** Smaller than this a number is no longer worth writing. */
export const MIN_VALUE_FONT = 7;

/**
 * The largest size these numbers can be written at and still fit the room
 * one mark gets - or 0 when even the smallest will not fit.
 *
 * A number that does not fit is SHRUNK before it is given up on. Dropping
 * straight from "it fits at eleven" to "no numbers at all" is what left
 * grouped and stacked bars bare: three series sharing one category's width
 * have a third of it each, which eleven-pixel figures rarely fit and eight-
 * pixel ones usually do. Below MIN_VALUE_FONT there is nothing legible
 * left to draw, and only then is the number left to the tooltip.
 */
export function fit_value_font(values, per_px, max_font, min_font) {
  const floor = min_font || MIN_VALUE_FONT;
  const room = Number(per_px);
  const top = Math.max(floor, Math.round(max_font || 11));
  if (!Number.isFinite(room)) return top;
  for (let font = top; font >= floor; font -= 1) {
    if (number_room(values, font) + 4 <= room) return font;
  }
  return 0;
}

/**
 * The same rows with an extra field holding only the values that are
 * actually going to be written. The marks keep reading the real field, so
 * thinning the labels never changes the chart itself.
 */
export function with_value_labels(rows, source_key, step) {
  if (step <= 1) return rows;
  return rows.map((row, index) => ({ ...row, [VALUE_LABEL_KEY]: index % step === 0 ? row[source_key] : null }));
}

/** Where a staggered number is written: one above the line, the next below. */
export const ABOVE_KEY = "__value_above";
export const BELOW_KEY = "__value_below";

/**
 * Numbers along a LINE, laid out so they can all be read.
 *
 * A line's points sit close together, and a row of numbers written above
 * them runs into itself long before the line itself is crowded. Writing
 * every other one BELOW the line instead doubles the room each number has
 * without dropping any of them - the reading zigzags, which is what a
 * dense line chart does everywhere it is done well. Only past what even
 * that can hold are numbers thinned, and then evenly.
 *
 * Returns the rows to draw plus the two fields the labels read from. The
 * "below" field is null when the numbers fit on one side and there is no
 * reason to make the eye jump.
 */
export function stagger_values(rows, source_key, per_px, values, font) {
  const need = number_room(values, font) + 6;
  const room = Math.max(1, per_px);
  const stagger = need > room;
  const step = Math.max(1, Math.ceil(need / (stagger ? room * 2 : room)));
  if (!stagger && step <= 1) return { rows, above: source_key, below: null, step: 1, stagger: false };
  let written = 0;
  const out = rows.map((row, index) => {
    if (index % step !== 0) return { ...row, [ABOVE_KEY]: null, [BELOW_KEY]: null };
    const below = stagger && written % 2 === 1;
    written += 1;
    return { ...row, [ABOVE_KEY]: below ? null : row[source_key], [BELOW_KEY]: below ? row[source_key] : null };
  });
  return { rows: out, above: ABOVE_KEY, below: stagger ? BELOW_KEY : null, step, stagger };
}
