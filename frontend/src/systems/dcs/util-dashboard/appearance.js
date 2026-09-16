import { SERIES_COLORS } from "./charts/chartTheme.js";

/**
 * A widget's appearance: its mode (light or dark), the background, text and
 * number colors of each mode, and one color per legend / category value.
 * build_palette turns that into everything a renderer needs, so charts and
 * cards never read the raw appearance themselves.
 */

export const MODE_DEFAULTS = {
  light: { background: "#FFFFFF", text: "#333333", number: "#056daa" },
  dark: { background: "#1E2A35", text: "#F2F5F8", number: "#7CC4FF" },
};

const MODE_EXTRAS = {
  light: { muted: "#9E9E9E", grid: "#E0E0E0", border: "#E0E0E0", empty: "#F4F7F9", soft: "#F4F7F9" },
  dark: { muted: "#A9B4C0", grid: "rgba(255,255,255,0.14)", border: "#2E3B48", empty: "rgba(255,255,255,0.08)", soft: "rgba(255,255,255,0.06)" },
};

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_PATTERN = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/i;

const to_hex_pair = (value) => Math.max(0, Math.min(255, Number(value))).toString(16).padStart(2, "0");

/** "#abc", "#AABBCC", "rgb(1, 2, 3)" or "rgba(...)" -> "#aabbcc"; anything else -> null. */
export function normalize_color(input) {
  const value = String(input || "").trim();
  if (HEX_PATTERN.test(value)) {
    const digits = value.slice(1);
    const full = digits.length === 3 ? digits.split("").map((digit) => digit + digit).join("") : digits;
    return `#${full.toLowerCase()}`;
  }
  const rgb = value.match(RGB_PATTERN);
  if (rgb) return `#${to_hex_pair(rgb[1])}${to_hex_pair(rgb[2])}${to_hex_pair(rgb[3])}`;
  return null;
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
  return { theme, legend_position, light: mode("light"), dark: mode("dark"), value_colors: { ...(source.value_colors || {}) } };
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
  const value_colors = appearance.value_colors;
  const color_for = (label, index) => value_colors[String(label)] || auto_color(index || 0);
  // The color this widget was told to use for one value, if any - a map
  // spreads its own colors and only wants to know about the exceptions.
  const color_override = (label) => value_colors[String(label)] || null;
  return {
    theme: appearance.theme,
    is_dark: appearance.theme === "dark",
    legend_position: appearance.legend_position,
    background: mode.background,
    text: mode.text,
    number: mode.number,
    accent: mode.number,
    muted: extras.muted,
    grid: extras.grid,
    border: extras.border,
    empty: extras.empty,
    soft: extras.soft,
    color_for,
    color_override,
    tick: { fontSize: 11, fill: mode.text },
    tooltip: { borderRadius: 0, border: `1px solid ${extras.border}`, fontSize: 12, backgroundColor: mode.background, color: mode.text },
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
