import { with_alpha } from "../appearance.js";

/**
 * How heat is measured and colored.
 *
 * A heat map says one thing: where the answers are dense. It is read off a
 * scale that runs from nothing, through the cool end, to the hot end - the
 * way every heat map is read - so the two colors a widget sets are the ends
 * of that scale and everything between them is interpolated. The lightest
 * stop is fully transparent, which is what makes heat fade into the map
 * rather than sit on it as a colored sheet.
 *
 * When a heat map is split by a choice field there is no single scale: each
 * value spreads its own heat in its own color, from transparent to that
 * color, and the legend names them.
 */

// The classic cool-to-hot pair, the one nearly every heat map opens with.
export const HEAT_LOW = "#2166ac";
export const HEAT_HIGH = "#b2182b";

// How far one answer's heat reaches, and how hard it burns. A tight spread
// shows single places; a wide one shows regions.
export const SPREADS = {
  tight: { radius: 16, intensity: 0.9 },
  balanced: { radius: 28, intensity: 1.3 },
  wide: { radius: 46, intensity: 2 },
};

export const spread_of = (name) => SPREADS[name] || SPREADS.balanced;

const channel = (hex, at) => parseInt(String(hex).replace("#", "").slice(at, at + 2), 16) || 0;
const pair = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");

/** One color part of the way to another. */
export function mix(from, to, share) {
  const at = Math.max(0, Math.min(1, share));
  const step = (index) => pair(channel(from, index) + (channel(to, index) - channel(from, index)) * at);
  return `#${step(0)}${step(2)}${step(4)}`;
}

/**
 * The color ramp of a heat layer, as MapLibre reads it: transparent where
 * there is nothing, then the low color, then the way to the high one.
 */
export function heat_ramp(low, high) {
  const cool = low || HEAT_LOW;
  const hot = high || HEAT_HIGH;
  return [
    0,
    with_alpha(cool, 0),
    0.15,
    with_alpha(cool, 0.5),
    0.35,
    with_alpha(mix(cool, hot, 0.35), 0.72),
    0.6,
    with_alpha(mix(cool, hot, 0.65), 0.85),
    0.85,
    with_alpha(hot, 0.92),
    1,
    hot,
  ];
}

/** The same scale as a row of colors, for a legend to draw. */
export const heat_steps = (low, high, count) => {
  const total = Math.max(2, count || 6);
  return Array.from({ length: total }, (entry, index) => mix(low || HEAT_LOW, high || HEAT_HIGH, index / (total - 1)));
};
