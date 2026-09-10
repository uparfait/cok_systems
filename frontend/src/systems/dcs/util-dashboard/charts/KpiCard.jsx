import React from "react";
import { PRIMARY } from "./chartTheme.js";

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
 * the widget's period is bounded. Deliberately COMPACT - KPI cards sit in a
 * dense grid at the top of the board, several per row, so the card stays
 * low and only a description ever adds height.
 */
export default function KpiCard({ value, previous, changePct, previousLabel }) {
  const direction = changePct === null || changePct === undefined ? null : changePct >= 0 ? "up" : "down";
  return (
    <div className="flex flex-col items-center justify-center text-center py-2">
      <span className="font-bold" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif", fontSize: 26, lineHeight: 1.1 }}>
        {format_number(value)}
      </span>
      <span className="flex flex-wrap items-center justify-center gap-x-2">
        {direction !== null && (
          <span className="mt-1 text-xs font-semibold" style={{ color: direction === "up" ? GOOD : BAD, fontFamily: "'Montserrat', sans-serif" }}>
            {direction === "up" ? "+" : ""}
            {format_number(changePct)}%
          </span>
        )}
        {previous !== null && previous !== undefined && (
          <span className="mt-1 text-xs" style={{ color: "#9E9E9E" }}>
            {previousLabel}: {format_number(previous)}
          </span>
        )}
      </span>
    </div>
  );
}
