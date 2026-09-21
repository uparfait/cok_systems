import React from "react";

const KPI_COUNT = 4;
const CHARTS = ["medium", "medium", "small", "small", "small", "large"];
const CHART_CLASS = {
  small: "grow basis-full sm:basis-[calc(50%-0.75rem)] lg:basis-[calc(33.333%-0.75rem)]",
  medium: "grow basis-full sm:basis-[calc(50%-0.75rem)]",
  large: "grow basis-full",
};

function Block({ className, style }) {
  return <div className={`dcs-skeleton-block ${className || ""}`} style={style} />;
}

export default function BoardSkeleton({ dark }) {
  return (
    <div className={`dcs-board-root dcs-board-public flex-1 min-w-0 max-w-full p-3 sm:p-5 space-y-4 ${dark ? "dcs-board-dark" : ""}`} style={{ backgroundColor: "var(--board-bg, #F4F7F9)" }} aria-busy="true">
      <div className="dcs-board-chrome p-3 sm:p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-2 min-w-0">
          <Block style={{ width: 220, maxWidth: "60vw", height: 18 }} />
          <Block style={{ width: 140, height: 12 }} />
        </div>
        <div className="flex gap-2">
          <Block style={{ width: 110, height: 34 }} />
          <Block style={{ width: 110, height: 34 }} />
          <Block style={{ width: 34, height: 34 }} />
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {Array.from({ length: KPI_COUNT }).map((_, index) => (
          <div key={index} className="dcs-board-chrome p-4 space-y-3">
            <Block style={{ width: "60%", height: 12 }} />
            <Block style={{ width: "40%", height: 28 }} />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        {CHARTS.map((size, index) => (
          <div key={index} className={`dcs-board-chrome p-4 min-w-0 space-y-3 ${CHART_CLASS[size]}`}>
            <Block style={{ width: "45%", height: 14 }} />
            <div className="flex items-end gap-2" style={{ height: size === "large" ? 180 : 140 }}>
              {Array.from({ length: size === "small" ? 5 : 9 }).map((_, bar) => (
                <Block key={bar} className="flex-1" style={{ height: `${30 + ((bar * 37 + index * 11) % 60)}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
