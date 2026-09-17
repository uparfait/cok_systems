import React from "react";
import { PatternSwatch } from "./patterns.jsx";

/**
 * The one legend every chart shares: entries stack in a COLUMN, one per
 * line, each with a round color marker, its full label and its value. A
 * chart with a third dimension shows two groups - the colors of the split
 * values and the textures of the pattern values. LegendFrame places the
 * legend under, above, left or right of the chart as the widget's
 * appearance asks.
 */

const LEGEND_FONT = { fontFamily: "'Montserrat', sans-serif" };

// The marker sits inside a plain (inline) span, so it must be a block-level
// box itself or its width and height are ignored and no color shows.
function Marker({ color, square }) {
  return <span className="flex-shrink-0" style={{ display: "inline-block", width: 10, height: 10, borderRadius: square ? 0 : "50%", backgroundColor: color, transition: "background-color 300ms ease" }} />;
}

export function LegendRow({ items, palette, square, title, onItemClick }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="min-w-0">
      {title && (
        <p className="text-[10px] font-bold uppercase mb-0.5" style={{ color: palette.muted, letterSpacing: "0.4px", ...LEGEND_FONT }}>
          {title}
        </p>
      )}
      {/* A long legend is a list to read through, not a wall to be
          blocked by: past a dozen entries it becomes its own scrolling
          column rather than pushing the chart off the card. */}
      <ul className="dcs-legend-column flex flex-col gap-1" style={{ listStyle: "none", margin: 0, padding: items.length > 12 ? "0 6px 0 0" : 0, maxHeight: items.length > 12 ? 260 : undefined, overflowY: items.length > 12 ? "auto" : "visible" }}>
        {items.map((item, index) => (
          <li
            key={`${item.label}-${index}`}
            className={`flex items-start gap-1.5 text-xs min-w-0 ${onItemClick ? "dcs-legend-clickable" : ""}`}
            style={{ color: palette.text }}
            onClick={onItemClick ? () => onItemClick(item.pick_label !== undefined ? item.pick_label : item.label) : undefined}
          >
            <span className="flex-shrink-0" style={{ marginTop: 3 }}>
              {item.pattern_index !== undefined && item.pattern_index > 0 ? <PatternSwatch index={item.pattern_index} color={item.color} size={12} /> : <Marker color={item.color} square={square} />}
            </span>
            <span className="break-words min-w-0 flex-1">
              {palette.name_for ? palette.name_for(item.label) : item.label}
            </span>
            {item.value !== undefined && item.value !== null && (
              <span className="font-semibold" style={{ color: palette.number, ...LEGEND_FONT }}>
                {typeof item.value === "number" ? item.value.toLocaleString("en-US") : item.value}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Legend of a split chart: colors per split, plus textures per pattern when there is a third field. */
export function SplitLegend({ display, totals, palette, splitTitle, patternTitle, onItemClick }) {
  if (display.patterns.length === 0) {
    return <LegendRow items={display.items.map((item) => ({ label: item.label, color: item.color, value: totals ? totals[item.key] : undefined }))} palette={palette} onItemClick={onItemClick} />;
  }
  const by_split = display.splits.map((split, index) => {
    const color = palette.color_for(split, index);
    const total = totals ? display.items.filter((item) => item.split === split).reduce((sum, item) => sum + (totals[item.key] || 0), 0) : undefined;
    return { label: split, color, value: total };
  });
  const by_pattern = display.patterns.map((pattern, index) => ({ label: pattern, color: "#8A94A0", pattern_index: Math.min(5, index) }));
  return (
    <div className="flex flex-col gap-1.5">
      <LegendRow items={by_split} palette={palette} title={splitTitle} onItemClick={onItemClick} />
      <LegendRow items={by_pattern} palette={palette} title={patternTitle} />
    </div>
  );
}

/**
 * Chart plus legend, arranged by the widget's legend position - top,
 * bottom, left or right, exactly as it was set, on every card. A narrow
 * card does not move the legend somewhere else; it gives a side legend a
 * narrower column, and the chart keeps the rest. Anything else made the
 * setting look ignored on the small and medium cards that make up most of
 * a board.
 */
export function LegendFrame({ position, legend, children, density }) {
  if (!legend) return children;
  if (position === "left" || position === "right") {
    const column = density && !density.side_legend ? "clamp(76px, 32%, 130px)" : "clamp(110px, 28%, 170px)";
    return (
      <div className={`flex gap-3 items-start min-w-0 ${position === "left" ? "flex-row" : "flex-row-reverse"}`}>
        <div className="flex-shrink-0" style={{ width: column, paddingTop: 8 }}>
          {legend}
        </div>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 min-w-0">
      {position === "top" && <div className="px-1 min-w-0">{legend}</div>}
      {children}
      {position !== "top" && <div className="px-1 min-w-0">{legend}</div>}
    </div>
  );
}
