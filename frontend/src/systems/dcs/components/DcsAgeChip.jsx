import React from "react";

/**
 * One unit of an age breakdown (e.g. "3" over "Yrs") - shared by the
 * project and form overview pages, both of which show the same
 * years/months/weeks/days/hours/minutes/seconds breakdown from
 * useAgeBreakdown.
 */
export default function DcsAgeChip({ value, labelKey, translate }) {
  return (
    <div
      className="flex flex-col items-center justify-center px-2.5 py-2"
      style={{ minWidth: 50, backgroundColor: "rgba(5,109,170,0.06)" }}
    >
      <span className="font-bold" style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif", fontSize: "1.05rem" }}>
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wide" style={{ color: "#555555", fontFamily: "'Montserrat', sans-serif" }}>
        {translate(labelKey)}
      </span>
    </div>
  );
}
