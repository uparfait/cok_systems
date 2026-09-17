import { SERIES_COLORS } from "./charts/chartTheme.js";

/**
 * A widget's appearance: its mode (light or dark), the background (which
 * may be see-through), text, number and border colors of each mode, one
 * color per legend / category value, and the
 * name each of those values is shown under - a stored answer stays what it
 * is, but a legend may call it something a reader understands.
 * build_palette turns that into everything a renderer needs, so charts and
 * cards never read the raw appearance themselves.
 */

export const MODE_DEFAULTS = {
  light: { background: "#FFFFFF", text: "#333333", number: "#056daa", border: "#E0E0E0" },
  dark: { background: "#1E2A35", text: "#F2F5F8", number: "#7CC4FF", border: "#2E3B48" },
};

const MODE_EXTRAS = {
  light: { muted: "#9E9E9E", grid: "#E0E0E0", empty: "#F4F7F9", soft: "#F4F7F9" },
  dark: { muted: "#A9B4C0", grid: "rgba(255,255,255,0.14)", empty: "rgba(255,255,255,0.08)", soft: "rgba(255,255,255,0.06)" },
};

// Four or eight digits carry an alpha channel: "#1e2a3580" is the dark
// background at half strength, and a widget set that way lets the board
// through behind it.
const HEX_PATTERN = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_PATTERN = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/i;

const to_hex_pair = (value) => Math.max(0, Math.min(255, Number(value))).toString(16).padStart(2, "0");

/**
 * "#abc", "#AABBCC", "rgb(1, 2, 3)" -> "#aabbcc"; anything carrying an
 * alpha - "#abcd", "#aabbccdd", "rgba(1, 2, 3, 0.5)" - keeps it as the
 * last two digits. Anything else -> null.
 */
export function normalize_color(input) {
  const value = String(input || "").trim();
  if (HEX_PATTERN.test(value)) {
    const digits = value.slice(1);
    const full = digits.length <= 4 ? digits.split("").map((digit) => digit + digit).join("") : digits;
    return `#${full.toLowerCase()}`;
  }
  const rgb = value.match(RGB_PATTERN);
  if (!rgb) return null;
  const alpha = rgb[4] === undefined || Number(rgb[4]) >= 1 ? "" : to_hex_pair(Math.round(Math.max(0, Number(rgb[4])) * 255));
  return `#${to_hex_pair(rgb[1])}${to_hex_pair(rgb[2])}${to_hex_pair(rgb[3])}${alpha}`;
}

/** The same color with any transparency taken off - "#1e2a3580" -> "#1e2a35". */
export function opaque_color(input) {
  const normalized = normalize_color(input);
  return normalized ? normalized.slice(0, 7) : null;
}

/** How see-through a color is, 0 (invisible) to 1 (solid). */
export function color_alpha(input) {
  const normalized = normalize_color(input);
  if (!normalized || normalized.length < 9) return 1;
  return Math.round((parseInt(normalized.slice(7, 9), 16) / 255) * 100) / 100;
}

/** The same color at this transparency; 1 leaves it solid. */
export function with_color_alpha(input, alpha) {
  const base = opaque_color(input) || "#ffffff";
  const level = Math.max(0, Math.min(1, Number(alpha)));
  return level >= 1 ? base : `${base}${to_hex_pair(Math.round(level * 255))}`;
}

export function auto_color(index) {
  return SERIES_COLORS[Math.abs(index) % SERIES_COLORS.length];
}

/**
 * A color per index that stays distinct over hundreds of them - the twelve
 * system colors would repeat every twelve shapes on a map of 161 cells.
 * The hue walks the wheel by the golden angle, so no two neighbours in the
 * list ever land near each other, and the lightness alternates to keep
 * even same-hue pairs apart.
 */
export function spread_color(index) {
  const step = Math.abs(Number(index) || 0);
  const hue = (step * 137.508) % 360;
  const lightness = 42 + (step % 3) * 8;
  return hsl_to_hex(hue, 62, lightness);
}

function hsl_to_hex(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const base = l - chroma / 2;
  const sector = Math.floor(hue / 60) % 6;
  const parts = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ][sector];
  return `#${parts.map((part) => Math.round((part + base) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function random_color() {
  // Mid-saturation, mid-lightness so any random pick stays readable.
  const hue = Math.floor(Math.random() * 360);
  const saturation = 55 + Math.floor(Math.random() * 30);
  const lightness = 42 + Math.floor(Math.random() * 16);
  const chroma = (1 - Math.abs((2 * lightness) / 100 - 1)) * (saturation / 100);
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness / 100 - chroma / 2;
  const [r, g, b] = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return `#${to_hex_pair((r + m) * 255)}${to_hex_pair((g + m) * 255)}${to_hex_pair((b + m) * 255)}`;
}

export const LEGEND_POSITIONS = ["bottom", "top", "right", "left"];

/** The stored appearance completed with defaults; null when nothing was customized. */
export function resolve_appearance(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const theme = source.theme === "dark" ? "dark" : "light";
  const mode = (name) => ({ ...MODE_DEFAULTS[name], ...(source[name] && typeof source[name] === "object" ? source[name] : {}) });
  const legend_position = LEGEND_POSITIONS.includes(source.legend_position) ? source.legend_position : "bottom";
  return { theme, legend_position, light: mode("light"), dark: mode("dark"), value_colors: { ...(source.value_colors || {}) }, value_labels: { ...(source.value_labels || {}) } };
}

/**
 * Everything a card or chart needs to paint itself. board_theme is the
 * viewer's page-wide mode (see boardTheme.jsx): "dark" paints every widget
 * with its dark color set regardless of its own saved mode; anything else
 * leaves the widget's own choice in charge.
 */
export function build_palette(raw, board_theme) {
  const appearance = resolve_appearance(raw);
  if (board_theme === "dark") appearance.theme = "dark";
  const mode = appearance[appearance.theme];
  const extras = MODE_EXTRAS[appearance.theme];
  // A translucent background is the widget's own look; anything that has
  // to paint a solid surface behind something (a map's base, a slice
  // outline) takes the same color with the transparency taken off.
  const solid = opaque_color(mode.background) || MODE_DEFAULTS[appearance.theme].background;
  const value_colors = appearance.value_colors;
  const color_for = (label, index) => value_colors[String(label)] || auto_color(index || 0);
  // The color this widget was told to use for one value, if any - a map
  // spreads its own colors and only wants to know about the exceptions.
  const color_override = (label) => value_colors[String(label)] || null;
  // What this value is CALLED here. Everything else about it is unchanged.
  const value_labels = appearance.value_labels || {};
  const name_for = (label) => {
    const named = value_labels[String(label)];
    return named === undefined || named === null || named === "" ? label : named;
  };
  return {
    theme: appearance.theme,
    is_dark: appearance.theme === "dark",
    legend_position: appearance.legend_position,
    background: mode.background,
    background_solid: solid,
    text: mode.text,
    number: mode.number,
    accent: mode.number,
    muted: extras.muted,
    grid: extras.grid,
    border: mode.border || MODE_DEFAULTS[appearance.theme].border,
    empty: extras.empty,
    soft: extras.soft,
    color_for,
    color_override,
    name_for,
    value_labels,
    tick: { fontSize: 11, fill: mode.text },
    tooltip: { borderRadius: 0, border: `1px solid ${mode.border || MODE_DEFAULTS[appearance.theme].border}`, fontSize: 12, backgroundColor: solid, color: mode.text },
    // Recharts paints tooltip rows black unless told otherwise - unreadable on a dark board.
    tooltip_text: { color: mode.text },
    legend_style: { fontSize: 11, color: mode.text },
  };
}

/** True when the appearance carries anything beyond the defaults. */
export function has_custom_appearance(raw) {
  if (!raw || typeof raw !== "object") return false;
  if (raw.theme === "dark") return true;
  if (raw.legend_position && raw.legend_position !== "bottom") return true;
  if (raw.value_colors && Object.keys(raw.value_colors).length > 0) return true;
  return ["light", "dark"].some((name) => raw[name] && Object.keys(raw[name]).some((key) => raw[name][key] && raw[name][key] !== MODE_DEFAULTS[name][key]));
}

/** "#056daa" -> "rgba(5, 109, 170, alpha)". */
export function with_alpha(hex, alpha) {
  const normalized = normalize_color(hex) || "#056daa";
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
