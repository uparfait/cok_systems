import React from "react";

/**
 * Placeholders shaped like whatever is coming. A spinner says only "wait";
 * these say what is about to appear, so the page does not visibly jump
 * when the real thing lands - a grid stays a grid, a form stays a form.
 */

const TINT = "rgba(5,109,170,0.10)";

function Bar({ width, height, radius }) {
  return <div className="animate-pulse" style={{ width, height: height || 12, backgroundColor: TINT, borderRadius: radius || 0 }} />;
}

/** The gallery: square tiles in the very grid the pictures land in. */
export function GallerySkeleton({ count }) {
  return (
    <div className="grid grid-cols-2 min-[480px]:grid-cols-3 min-[720px]:grid-cols-4 min-[1000px]:grid-cols-5 min-[1320px]:grid-cols-6 gap-2" aria-hidden="true">
      {Array.from({ length: count || 10 }).map((_, index) => (
        <div key={index} className="animate-pulse" style={{ aspectRatio: "1 / 1", backgroundColor: TINT, border: "1px solid #E0E0E0" }} />
      ))}
    </div>
  );
}

/** A panel of labelled inputs: Downloads and the schedule's own settings. */
export function FormPanelSkeleton({ rows }) {
  return (
    <div className="bg-white border-2 p-4 sm:p-5 space-y-5" style={{ borderColor: "#E0E0E0" }} aria-hidden="true">
      {Array.from({ length: rows || 4 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Bar width={`${28 + (index % 3) * 8}%`} height={10} />
          <Bar width="100%" height={38} />
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <Bar width={120} height={38} />
        <Bar width={120} height={38} />
      </div>
    </div>
  );
}

/** Repeated cards: the share links, the approvers of a schedule. */
export function CardListSkeleton({ count }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: count || 3 }).map((_, index) => (
        <div key={index} className="bg-white border-2 p-3 sm:p-4 space-y-2.5" style={{ borderColor: "#E0E0E0" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1 min-w-0">
              <Bar width={`${40 - index * 6}%`} height={14} />
              <Bar width={`${60 - index * 8}%`} height={10} />
            </div>
            <Bar width={64} height={12} />
          </div>
          <Bar width="100%" height={28} />
          <Bar width="100%" height={28} />
        </div>
      ))}
    </div>
  );
}

/** Two columns of settings, as the approval schedule page lays them out. */
export function TwoColumnSkeleton() {
  return (
    <div className="bg-white border-2 p-4 sm:p-5" style={{ borderColor: "#E0E0E0" }} aria-hidden="true">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[0, 1].map((column) => (
          <div key={column} className="space-y-3">
            <Bar width="34%" height={10} />
            {[0, 1, 2].map((row) => (
              <Bar key={row} width="100%" height={row === 0 ? 56 : 44} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The data table itself: a blue header band over banded rows. */
export function TableSkeleton({ columns, rows }) {
  const column_count = columns || 6;
  return (
    <div className="bg-white border-2 overflow-hidden" style={{ borderColor: "#E0E0E0" }} aria-hidden="true">
      <div className="flex gap-px px-3 py-3" style={{ backgroundColor: "#056daa" }}>
        {Array.from({ length: column_count }).map((_, index) => (
          <div key={index} className="flex-1 animate-pulse" style={{ height: 12, backgroundColor: "rgba(255,255,255,0.35)" }} />
        ))}
      </div>
      {Array.from({ length: rows || 8 }).map((_, row_index) => (
        <div
          key={row_index}
          className="flex gap-3 px-3 py-3"
          style={{ backgroundColor: row_index % 2 === 1 ? "#F7F9FB" : "#FFFFFF", borderBottom: "1px solid #E0E0E0" }}
        >
          {Array.from({ length: column_count }).map((_, column_index) => (
            <div key={column_index} className="flex-1 animate-pulse" style={{ height: 11, backgroundColor: TINT }} />
          ))}
        </div>
      ))}
    </div>
  );
}
