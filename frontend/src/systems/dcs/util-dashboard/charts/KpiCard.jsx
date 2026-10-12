import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { build_palette } from "../appearance.js";
import { chart_density, kpi_density } from "./density.js";

const NUMBER_FONT = "700 {size}px Montserrat, sans-serif";
const widths = new Map();
let measure_ctx = null;

/**
 * How wide the number comes out at this font size, measured in the BOLD
 * Montserrat it is drawn in - the chart labels' measurer uses the regular
 * weight, and bold digits are a fifth wider, which is the difference
 * between a figure that fits and one cut off at the card's edge. Widths
 * are only remembered once the face has loaded; before that a fallback
 * face is measured and the card measures again when the fonts are ready.
 */
function number_width(text, size) {
  const value = String(text);
  const key = `${size}|${value}`;
  if (widths.has(key)) return widths.get(key);
  if (!measure_ctx && typeof document !== "undefined") measure_ctx = document.createElement("canvas").getContext("2d");
  if (!measure_ctx) return value.length * size * 0.7;
  measure_ctx.font = NUMBER_FONT.replace("{size}", String(size));
  const width = measure_ctx.measureText(value).width;
  const loaded = !!(document.fonts && document.fonts.check && document.fonts.check(NUMBER_FONT.replace("{size}", "16")));
  if (loaded) {
    if (widths.size > 2000) widths.clear();
    widths.set(key, width);
  }
  return width;
}

/** Re-renders once the page's fonts have loaded, so a number measured against a fallback face is sized again. */
function useFontsReady() {
  const [, bump] = useState(0);
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts || !document.fonts.ready) return undefined;
    let active = true;
    document.fonts.ready.then(() => active && bump((count) => count + 1));
    return () => { active = false; };
  }, []);
}

const GOOD = "#27AE60";
const BAD = "#E74C3C";
const COUNT_DURATION_MS = 650;

function format_number(value) {
  if (value === null || value === undefined) return "0";
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString("en-US");
}

/**
 * Glides from the previously shown number to the new one, so a card whose
 * value grows or shrinks on a refresh visibly counts up or down instead of
 * snapping. Decimals are kept when the target has them.
 */
function useAnimatedNumber(target) {
  const [shown, setShown] = useState(target || 0);
  const from_ref = useRef(target || 0);
  useEffect(() => {
    const from = from_ref.current;
    const to = target || 0;
    if (from === to) return undefined;
    const decimals = Number.isInteger(to) && Number.isInteger(from) ? 0 : 2;
    const started = performance.now();
    let frame = 0;
    const step = (now) => {
      const progress = Math.min(1, (now - started) / COUNT_DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setShown(decimals === 0 ? Math.round(current) : Math.round(current * 100) / 100);
      if (progress < 1) frame = window.requestAnimationFrame(step);
      else from_ref.current = to;
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

function AnimatedNumber({ value, style, className, format }) {
  const shown = useAnimatedNumber(value);
  return (
    <span className={className} style={style}>
      {format ? format(shown) : format_number(shown)}
    </span>
  );
}

/**
 * The single-number widget: the aggregated value of the current window
 * (counting up or down as it changes, and carrying the widget's unit -
 * "$12", "1200RWF"), the change against the equally long
 * window right before it whenever the widget's period is bounded, and -
 * when the card carries a legend - one row per value under the total, each
 * in its own color. Deliberately COMPACT - KPI cards sit in a dense grid at
 * the top of the board, several per row, and every card in a row is as
 * tall as the tallest, so a long legend does not lengthen one card, it
 * lengthens the whole row. Past a handful of values the card therefore
 * shows the first two and opens the rest on request.
 *
 * The number draws in the widget's number color, the rest follows its
 * light or dark mode, and each value is called whatever the widget's
 * appearance renamed it to.
 */

// Up to this many values are simply listed; beyond it the card shows
// PREVIEW of them and a line that opens the rest.
const LIST_ALL_UNDER = 4;
const PREVIEW = 2;
const NUMBER_LINE = 1.1;
const LEGEND_LINE = 1.6;
const CARD_PADDING = 20;
const WORD_ROW = 14;
const SMALL_ROW = 20;

/**
 * The number is the card's whole point, so it is written as TALL as the
 * room the card was given allows: the card's height, less what its other
 * lines take (a word over the number, the legend rows, the "show more"
 * line, the change against the previous window) - and then, if that
 * figure is still too wide for the card, it SHRINKS until it fits rather
 * than wrapping. "$1.2bn Rwf" comes out smaller than "42" does, which is
 * right: a number broken across two lines has stopped being a number
 * anyone can read at a glance. A card whose room is not known yet (its
 * first paint, or a card sized by what it holds) writes the width
 * profile's size, so it can never grow the card it sits in.
 */
function number_font_for(text, width, room_height, parts) {
  let left = room_height - CARD_PADDING;
  if (parts.total) left -= WORD_ROW;
  if (parts.legend_rows > 0) left -= 8 + parts.legend_rows * Math.round(parts.legend_font * LEGEND_LINE);
  if (parts.folds) left -= SMALL_ROW;
  if (parts.change) left -= SMALL_ROW;
  const by_height = room_height > 0 ? Math.floor(left / NUMBER_LINE) : 0;
  // The width's own ceiling, so the shrinking below starts near the answer
  // instead of walking down from a figure the card could never hold.
  const max_px = Math.max(48, width - 16);
  const per_px = number_width(text, 100) / 100;
  const by_width = per_px > 0 ? Math.floor(max_px / per_px) : by_height;
  let font = Math.max(11, parts.floor, Math.min(by_height, by_width));
  while (font > 8 && number_width(text, font) > max_px) font -= 1;
  return font;
}

export default function KpiCard({ value, changePct, legend, totalLabel, palette, density, roomHeight, onLegendClick }) {
  const colors = palette || build_palette(null);
  const size = density || chart_density();
  // What this card's own width allows: a card made very small writes a
  // smaller number, not a number spilling out of it.
  const room = kpi_density(size.width);
  const direction = changePct === null || changePct === undefined ? null : changePct >= 0 ? "up" : "down";
  const has_legend = Array.isArray(legend) && legend.length > 0;
  const { translate } = useDcsLanguage();
  const [open, setOpen] = useState(false);
  useFontsReady();
  const rows = has_legend ? legend : [];
  const folds = rows.length >= LIST_ALL_UNDER;
  const shown = folds && !open ? rows.slice(0, PREVIEW) : rows;
  const room_height = Number(roomHeight) > 0 ? Number(roomHeight) : 0;
  // The legend grows with the card too, within reason.
  const legend_font = room_height > 0 ? Math.max(room.legend, Math.min(16, Math.round(room_height / 10))) : room.legend;
  const number_font = number_font_for(colors.number_text(value), size.width, room_height, { total: !!totalLabel, legend_rows: shown.length, legend_font, folds, change: direction !== null, floor: room.number });
  return (
    <div className="flex flex-col items-center justify-center text-center py-2 min-w-0">
      {/* Nothing is written over the number unless it says something the
          card's own title does not. "TOTAL" did not - it sat between the
          title and the figure telling nobody anything - so it is gone. An
          occurrence card's line ("values matching the rule") stays, because
          the figure means nothing without it. */}
      {totalLabel ? (
        <span className="text-[10px] font-semibold uppercase" style={{ color: colors.muted, fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
          {totalLabel}
        </span>
      ) : null}
      <AnimatedNumber value={value} format={colors.number_text} className="font-bold whitespace-nowrap" style={{ color: colors.number, fontFamily: "'Montserrat', sans-serif", fontSize: number_font, lineHeight: 1.1, maxWidth: "100%" }} />
      {has_legend && (
        <ul className="dcs-kpi-legend w-full mt-2 px-1 flex flex-col gap-0.5 text-left" style={{ listStyle: "none", margin: 0 }}>
          {shown.map((row, index) => (
            <li key={`${row.label}-${index}`} className={`flex items-center justify-between gap-2 min-w-0 ${onLegendClick ? "dcs-legend-clickable" : ""}`} style={{ opacity: row.matches === false ? 0.6 : 1, fontSize: legend_font }} onClick={onLegendClick ? () => onLegendClick(row) : undefined}>
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="flex-shrink-0" style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: colors.color_for(row.label, index), transition: "background-color 300ms ease" }} />
                {/* An occurrence card showing every value marks the ones that met its rule. */}
                <span className={`break-words min-w-0 ${row.matches === true ? "font-semibold" : ""}`} style={{ color: colors.text }}>
                  {colors.name_for ? colors.name_for(row.label) : row.label}
                </span>
              </span>
              <AnimatedNumber value={row.value} format={colors.number_text} className="font-semibold flex-shrink-0" style={{ color: colors.number, fontFamily: "'Montserrat', sans-serif" }} />
            </li>
          ))}
        </ul>
      )}
      {folds && (
        <button
          type="button"
          className="dcs-no-drill mt-1 text-xs"
          style={{ color: colors.number, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "'Montserrat', sans-serif" }}
          onClick={(event) => {
            event.stopPropagation();
            setOpen((current) => !current);
          }}
        >
          {open ? translate("DCS_DB_SHOW_LESS") : translate("DCS_DB_SHOW_MORE", { count: rows.length - PREVIEW })}
        </button>
      )}
      {direction !== null && (
        <span className="mt-1 text-xs font-semibold" style={{ color: direction === "up" ? GOOD : BAD, fontFamily: "'Montserrat', sans-serif" }}>
          {direction === "up" ? "+" : ""}
          {format_number(changePct)}%
        </span>
      )}
    </div>
  );
}
