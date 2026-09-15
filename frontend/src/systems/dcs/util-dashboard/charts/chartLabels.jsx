import React from "react";

/**
 * Axis labels that are never cut: a long category name wraps onto several
 * lines (word by word, hard-breaking only a single word longer than a
 * line), and the axis reserves the room those lines need. Recharts hands
 * every tick to WrappedTick, which draws the lines as tspans.
 */

const LINE_HEIGHT = 13;
const CHAR_WIDTH = 6.4;
export const MAX_LINES = 5;

export function wrap_label(text, max_chars) {
  const words = String(text === undefined || text === null ? "" : text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= max_chars) {
      current = candidate;
      return;
    }
    if (current) lines.push(current);
    let rest = word;
    while (rest.length > max_chars) {
      lines.push(rest.slice(0, max_chars));
      rest = rest.slice(max_chars);
    }
    current = rest;
  });
  if (current) lines.push(current);
  if (lines.length > MAX_LINES) {
    const kept = lines.slice(0, MAX_LINES);
    kept[MAX_LINES - 1] = `${kept[MAX_LINES - 1]}...`;
    return kept;
  }
  return lines.length > 0 ? lines : [""];
}

/** How many characters fit on one line for a given pixel width. */
export const chars_for_width = (px) => Math.max(6, Math.floor(px / CHAR_WIDTH));

/** The tallest wrapped label of a row set, in lines. */
export function max_lines(labels, max_chars) {
  return labels.reduce((best, label) => Math.max(best, wrap_label(label, max_chars).length), 1);
}

/** Height an X axis needs for wrapped labels. */
export const x_axis_height = (labels, max_chars) => max_lines(labels, max_chars) * LINE_HEIGHT + 14;

/** Width a category Y axis needs: the longest line, capped, never truncating. */
export function y_axis_width(labels, max_px) {
  const max_chars = chars_for_width(max_px);
  const longest = labels.reduce((best, label) => Math.max(best, ...wrap_label(label, max_chars).map((line) => line.length)), 4);
  return Math.min(max_px, Math.max(48, Math.round(longest * CHAR_WIDTH) + 12));
}

/** Row height for horizontal bars so wrapped labels never overlap. */
export function bar_row_height(labels, max_px, base) {
  return Math.max(base, max_lines(labels, chars_for_width(max_px)) * LINE_HEIGHT + 10);
}

/**
 * A Recharts tick that draws its label on several lines. `anchor` is
 * "middle" for an X axis (centered under the tick) and "end" for a Y axis
 * (right-aligned against the axis).
 */
export function WrappedTick({ x, y, payload, fill, maxChars, anchor, fontSize }) {
  const lines = wrap_label(payload && payload.value, maxChars);
  const vertical = anchor === "end";
  const first_dy = vertical ? -((lines.length - 1) * LINE_HEIGHT) / 2 + 4 : 12;
  return (
    <text x={x} y={y} fill={fill} fontSize={fontSize || 11} textAnchor={anchor || "middle"}>
      {lines.map((line, index) => (
        <tspan key={index} x={vertical ? x - 6 : x} dy={index === 0 ? first_dy : LINE_HEIGHT}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/** Tick renderer factory bound to a palette and wrapping width. */
export const wrapped_tick = (palette, max_chars, anchor) => (props) => <WrappedTick {...props} fill={palette.text} maxChars={max_chars} anchor={anchor} />;
