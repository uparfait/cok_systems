import React from "react";
import { build_palette } from "../appearance.js";

const GOOD = "#27AE60";
const BAD = "#E74C3C";

function format_number(value) {
  if (value === null || value === undefined) return "0";
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString("en-US");
}

/**
 * The single-number widget: the aggregated value of the current window,
 * plus the change against the equally long window right before it whenever
 * the widget's period is bounded, and - when the card carries a legend -
 * one row per value under the total, each in its own color. Deliberately
 * COMPACT - KPI cards sit in a dense grid at the top of the board, several
 * per row. The number draws in the widget's number color, the rest follows
 * its light or dark mode.
 */
export default function KpiCard({ value, previous, changePct, previousLabel, legend, totalLabel, palette }) {
  const colors = palette || build_palette(null);
  const direction = changePct === null || changePct === undefined ? null : changePct >= 0 ? "up" : "down";
  const has_legend = Array.isArray(legend) && legend.length > 0;
  return (
    <div className="flex flex-col items-center justify-center text-center py-2">
      {has_legend && (
        <span className="text-[10px] font-semibold uppercase" style={{ color: colors.muted, fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
          {totalLabel}
        </span>
      )}
      <span className="font-bold" style={{ color: colors.number, fontFamily: "'Montserrat', sans-serif", fontSize: 26, lineHeight: 1.1 }}>
        {format_number(value)}
      </span>
      {has_legend && (
        <ul className="dcs-kpi-legend w-full mt-2 px-1 grid gap-x-3 gap-y-0.5 text-left" style={{ gridTemplateColumns: legend.length > 3 ? "1fr 1fr" : "1fr" }}>
          {legend.map((row, index) => (
            <li key={`${row.label}-${index}`} className="flex items-center justify-between gap-2 text-xs min-w-0">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="flex-shrink-0" style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: colors.color_for(row.label, index) }} />
                <span className="truncate" style={{ color: colors.text }} title={row.label}>
                  {row.label}
                </span>
              </span>
              <span className="font-semibold flex-shrink-0" style={{ color: colors.number, fontFamily: "'Montserrat', sans-serif" }}>
                {format_number(row.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <span className="flex flex-wrap items-center justify-center gap-x-2">
        {direction !== null && (
          <span className="mt-1 text-xs font-semibold" style={{ color: direction === "up" ? GOOD : BAD, fontFamily: "'Montserrat', sans-serif" }}>
            {direction === "up" ? "+" : ""}
            {format_number(changePct)}%
          </span>
        )}
        {previous !== null && previous !== undefined && (
          <span className="mt-1 text-xs" style={{ color: colors.muted }}>
            {previousLabel}: {format_number(previous)}
          </span>
        )}
      </span>
    </div>
  );
}
