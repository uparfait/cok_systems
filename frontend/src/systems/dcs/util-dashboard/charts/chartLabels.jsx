import React from "react";

/**
 * Nothing a chart draws may be cut off. Every label is MEASURED, not
 * estimated: a canvas reports the real pixel width of the exact string in
 * the exact font the chart will draw it in, so an axis always reserves the
 * room its longest label truly needs. A character-count guess is what once
 * turned "Nyarugenge" into "yarugenge" against the left edge.
 *
 * Labels therefore wrap by WIDTH, not by character count: a line is filled
 * until the next word would not fit, and a single word longer than a line
 * is broken at the last character that does.
 */

// Text is drawn 6px clear of the axis, plus a little breathing room.
const AXIS_GAP = 6;
const AXIS_PAD = 10;
// A label is only ever shortened past this many lines - far beyond any
// real name, so in practice every label is drawn in full.
export const MAX_LINES = 60;

let measure_context;
let measure_family;

function context() {
  if (measure_context !== undefined) return measure_context;
  try {
    measure_context = document.createElement("canvas").getContext("2d");
  } catch (error) {
    measure_context = null;
  }
  return measure_context;
}

function family() {
  if (measure_family) return measure_family;
  try {
    measure_family = window.getComputedStyle(document.body).fontFamily || "sans-serif";
  } catch (error) {
    measure_family = "sans-serif";
  }
  return measure_family;
}

const widths = new Map();

/** The real rendered width of one string, in pixels. */
export function text_width(text, font) {
  const value = String(text === undefined || text === null ? "" : text);
  const size = font || 11;
  const key = `${size}|${value}`;
  if (widths.has(key)) return widths.get(key);
  const ctx = context();
  // Without a canvas (a non-browser render) fall back to a safe over-estimate.
  const width = ctx ? ((ctx.font = `${size}px ${family()}`), ctx.measureText(value).width) : value.length * size * 0.62;
  if (widths.size > 4000) widths.clear();
  widths.set(key, width);
  return width;
}

/** The longest word of a label, measured - no axis narrower than this reads. */
export const widest_word = (text, font) =>
  String(text === undefined || text === null ? "" : text)
    .split(/\s+/)
    .filter(Boolean)
    .reduce((best, word) => Math.max(best, text_width(word, font)), 0);

/** Breaks one over-long word at the last character that still fits. */
function break_word(word, max_px, font, lines) {
  let rest = word;
  while (text_width(rest, font) > max_px && rest.length > 1) {
    let cut = rest.length - 1;
    while (cut > 1 && text_width(rest.slice(0, cut), font) > max_px) cut -= 1;
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  return rest;
}

/** One label as the lines it needs, each no wider than max_px. */
export function wrap_label(text, max_px, font) {
  const limit = Math.max(12, max_px);
  const words = String(text === undefined || text === null ? "" : text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (text_width(candidate, font) <= limit) {
      current = candidate;
      return;
    }
    if (current) lines.push(current);
    current = break_word(word, limit, font, lines);
  });
  if (current) lines.push(current);
  if (lines.length > MAX_LINES) {
    const kept = lines.slice(0, MAX_LINES);
    kept[MAX_LINES - 1] = `${kept[MAX_LINES - 1]}...`;
    return kept;
  }
  return lines.length > 0 ? lines : [""];
}

/** The tallest wrapped label of a set, in lines. */
export const max_lines = (labels, max_px, font) => labels.reduce((best, label) => Math.max(best, wrap_label(label, max_px, font).length), 1);

/** Height an X axis needs for wrapped labels - every line of the tallest one. */
export const x_axis_height = (labels, max_px, font) => max_lines(labels, max_px, font) * ((font || 11) + 2) + 14;

/**
 * Width a category Y axis needs: its labels wrapped into whatever room is
 * allowed, then the widest line that actually resulted, plus the gap the
 * tick leaves against the axis. Never wider than the cap, never so narrow
 * that a single word is clipped.
 */
export function y_axis_width(labels, cap_px, font) {
  const room = Math.max(40, cap_px - AXIS_GAP - AXIS_PAD);
  const longest = labels.reduce((best, label) => Math.max(best, ...wrap_label(label, room, font).map((line) => text_width(line, font))), 30);
  const needed = Math.ceil(longest) + AXIS_GAP + AXIS_PAD;
  return Math.min(Math.max(cap_px, 44), Math.max(44, needed));
}

/** The text room a Y axis of this width leaves for its labels. */
export const y_label_room = (axis_width) => Math.max(24, axis_width - AXIS_GAP - AXIS_PAD);

/**
 * The most of a string that fits one line of max_px, measured - the whole
 * string when it fits, otherwise as much of it as does with an ellipsis.
 * Returns "" when not even an ellipsis fits, so nothing ever spills.
 */
export function fit_text(text, max_px, font) {
  const value = String(text === undefined || text === null ? "" : text);
  if (text_width(value, font) <= max_px) return value;
  if (text_width("...", font) > max_px) return "";
  let cut = value.length - 1;
  while (cut > 0 && text_width(`${value.slice(0, cut)}...`, font) > max_px) cut -= 1;
  return cut > 0 ? `${value.slice(0, cut)}...` : "";
}

/** Row height for horizontal bars so wrapped labels never overlap. */
export const bar_row_height = (labels, max_px, base, font) => Math.max(base, max_lines(labels, max_px, font) * ((font || 11) + 2) + 10);

/** The widest any of these numbers renders as, in pixels. */
export const number_room = (values, font) =>
  Math.ceil(
    (values || []).reduce((best, value) => {
      const text = typeof value === "number" ? Math.round(value).toLocaleString("en-US") : String(value === undefined || value === null ? "" : value);
      return Math.max(best, text_width(text, font));
    }, 8),
  ) + 6;

/** Room a numeric axis needs so its largest tick is never clipped. */
export const value_axis_width = (values, font) => Math.max(28, Math.min(140, number_room(values, font) + AXIS_GAP));

/**
 * A Recharts tick that draws its label on several lines. `anchor` is
 * "middle" for an X axis (centered under the tick) and "end" for a Y axis
 * (right-aligned against the axis).
 */
export function WrappedTick({ x, y, payload, fill, maxPx, anchor, fontSize }) {
  const size = fontSize || 11;
  const step = size + 2;
  const lines = wrap_label(payload && payload.value, maxPx, size);
  const vertical = anchor === "end";
  const first_dy = vertical ? -((lines.length - 1) * step) / 2 + 4 : size + 2;
  return (
    <text x={x} y={y} fill={fill} fontSize={size} textAnchor={anchor || "middle"}>
      {lines.map((line, index) => (
        <tspan key={index} x={vertical ? x - AXIS_GAP : x} dy={index === 0 ? first_dy : step}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/** Tick renderer factory bound to a palette, a pixel width and a font size. */
export const wrapped_tick = (palette, max_px, anchor, font_size) => (props) => <WrappedTick {...props} fill={palette.text} maxPx={max_px} anchor={anchor} fontSize={font_size} />;
