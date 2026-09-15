/**
 * The system palette every chart falls back to: primary blue first, then
 * clearly distinguishable companions. A widget's own per-value colors
 * override these (see appearance.js), and every other measurement a chart
 * makes - height, fonts, bar sizes, label room - comes from the card it
 * was given (see density.js), never from a shared constant.
 */

export const SERIES_COLORS = [
  "#056daa",
  "#F2994A",
  "#27AE60",
  "#9B51E0",
  "#EB5757",
  "#2D9CDB",
  "#F2C94C",
  "#6FCF97",
  "#BB6BD9",
  "#56CCF2",
  "#828282",
  "#219653",
];
