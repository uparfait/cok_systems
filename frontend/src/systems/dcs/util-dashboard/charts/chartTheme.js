/**
 * Shared look of every dashboard chart: the system palette (primary blue
 * first, then clearly distinguishable companions) and the common Recharts
 * props, so all widgets read as one family.
 */

export const PRIMARY = "#056daa";

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

export const series_color = (index) => SERIES_COLORS[index % SERIES_COLORS.length];

export const TOOLTIP_STYLE = { borderRadius: 0, border: "1px solid #E0E0E0", fontSize: 12 };

export const AXIS_TICK = { fontSize: 11 };

export const GRID_STROKE = "#E0E0E0";

export const CHART_HEIGHT = 260;
