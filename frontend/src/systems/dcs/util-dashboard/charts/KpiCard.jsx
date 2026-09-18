import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { build_palette } from "../appearance.js";
import { chart_density } from "./density.js";
import { fit_text_font } from "./labelDensity.jsx";

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
export default function KpiCard({ value, changePct, legend, totalLabel, palette, density, onLegendClick }) {
  const colors = palette || build_palette(null);
  const size = density || chart_density();
  // The number is the card's whole point, so it takes as much of the card's
  // width as it can without ever spilling out of a narrow one - and then,
  // if the finished text is still too long for that, it SHRINKS to fit
  // rather than wrapping. "$1.2bn Rwf" comes out smaller than "42" does,
  // which is right: a number broken across two lines has stopped being a
  // number anyone can read at a glance.
  const roomy_font = Math.max(17, Math.min(28, Math.round(size.width / 8)));
  const number_font = fit_text_font(colors.number_text(value), Math.max(60, size.width - 24), roomy_font, 11);
  const direction = changePct === null || changePct === undefined ? null : changePct >= 0 ? "up" : "down";
  const has_legend = Array.isArray(legend) && legend.length > 0;
  const { translate } = useDcsLanguage();
  const [open, setOpen] = useState(false);
  const rows = has_legend ? legend : [];
  const folds = rows.length >= LIST_ALL_UNDER;
  const shown = folds && !open ? rows.slice(0, PREVIEW) : rows;
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
      <AnimatedNumber value={value} format={colors.number_text} className="font-bold break-all" style={{ color: colors.number, fontFamily: "'Montserrat', sans-serif", fontSize: number_font, lineHeight: 1.1, maxWidth: "100%" }} />
      {has_legend && (
        <ul className="dcs-kpi-legend w-full mt-2 px-1 flex flex-col gap-0.5 text-left" style={{ listStyle: "none", margin: 0, maxHeight: shown.length > 12 ? 280 : undefined, overflowY: shown.length > 12 ? "auto" : "visible" }}>
          {shown.map((row, index) => (
            <li key={`${row.label}-${index}`} className={`flex items-center justify-between gap-2 text-xs min-w-0 ${onLegendClick ? "dcs-legend-clickable" : ""}`} style={{ opacity: row.matches === false ? 0.6 : 1 }} onClick={onLegendClick ? () => onLegendClick(row) : undefined}>
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
