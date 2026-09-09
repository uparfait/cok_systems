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
 * the widget's period is bounded.
 */
export default function KpiCard({ value, previous, changePct, previousLabel }) {
  const direction = changePct === null || changePct === undefined ? null : changePct >= 0 ? "up" : "down";
  return (
    <div className="flex flex-col items-center justify-center text-center py-8">
      <span className="font-bold" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif", fontSize: 40, lineHeight: 1.1 }}>
        {format_number(value)}
      </span>
      {direction !== null && (
        <span className="mt-2 text-sm font-semibold" style={{ color: direction === "up" ? GOOD : BAD, fontFamily: "'Montserrat', sans-serif" }}>
          {direction === "up" ? "+" : ""}
          {format_number(changePct)}%
        </span>
      )}
      {previous !== null && previous !== undefined && (
        <span className="mt-1 text-xs" style={{ color: "#9E9E9E" }}>
          {previousLabel}: {format_number(previous)}
        </span>
      )}
    </div>
  );
}
