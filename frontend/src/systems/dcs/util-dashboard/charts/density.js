/**
 * How big a chart may draw itself inside the card it was given. A widget's
 * size (small, medium, large) decides the card's width, and the card NEVER
 * grows to fit its chart - the chart shrinks to fit the card. Everything
 * that would otherwise push a card wider or spill out of it is scaled from
 * the measured width here: the chart's height, its axis fonts, how many
 * characters a wrapped label may use, how wide a category axis may get,
 * bar thickness, the pie radius, how small value labels are written,
 * whether a legend may sit beside the chart, and the minimum width one
 * time point or one heatmap column claims before the chart scrolls inside
 * the card. min_col_px is the least room one category gets on a category
 * axis (past that, the chart widens and scrolls sideways inside the card
 * rather than stacking its labels), and max_height caps a bar chart of
 * many rows before it scrolls vertically inside the card.
 */

const PROFILES = [
  // Very narrow (a small card on a laptop, or any card on a phone).
  { max: 300, height: 150, font: 9, value_font: 8, x_chars: 7, y_max: 84, bar: 14, column_bar: 18, row_base: 26, pie: "54%", side_legend: false, point_px: 26, cell_px: 44, min_col_px: 54, max_height: 480 },
  { max: 420, height: 180, font: 9, value_font: 9, x_chars: 9, y_max: 110, bar: 16, column_bar: 24, row_base: 28, pie: "58%", side_legend: false, point_px: 30, cell_px: 52, min_col_px: 62, max_height: 560 },
  { max: 600, height: 215, font: 10, value_font: 10, x_chars: 12, y_max: 150, bar: 20, column_bar: 32, row_base: 30, pie: "62%", side_legend: false, point_px: 36, cell_px: 60, min_col_px: 72, max_height: 640 },
  // Roomy (a medium or large card on a wide screen).
  { max: Infinity, height: 260, font: 11, value_font: 11, x_chars: 16, y_max: 240, bar: 22, column_bar: 40, row_base: 34, pie: "66%", side_legend: true, point_px: 44, cell_px: 72, min_col_px: 84, max_height: 760 },
];

export const DEFAULT_WIDTH = 520;

/** The sizing profile for a card of this pixel width. */
export function chart_density(width) {
  const measured = Number(width) > 0 ? Number(width) : DEFAULT_WIDTH;
  const profile = PROFILES.find((entry) => measured < entry.max) || PROFILES[PROFILES.length - 1];
  return Object.assign({ width: measured, show_values: profile.value_font > 0 }, profile);
}

/** The axis tick style of a palette, resized for this card. */
export const tick_style = (palette, density) => Object.assign({}, palette.tick, { fontSize: density.font });

/** The style of a value written on a mark. */
export const value_style = (palette, density, size) => ({ fontSize: size || density.value_font, fontWeight: 600, fill: palette.text });
