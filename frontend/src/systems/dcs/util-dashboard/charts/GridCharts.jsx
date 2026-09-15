import React from "react";
import { CHART_HEIGHT } from "./chartTheme.js";
import { build_palette, with_alpha } from "../appearance.js";
import { LegendRow, LegendFrame } from "./SeriesLegend.jsx";

/**
 * The two grid-based renderers that Recharts has no primitive for, drawn
 * with plain elements: the heatmap (rows x series matrix, color intensity
 * carries the value) and the waffle (one hundred cells, each one percent).
 * The heatmap tints with the widget's number color; the waffle uses its
 * per-value colors; text follows the light or dark mode.
 */

function heat_color(value, max, palette) {
  if (!max || value <= 0) return palette.empty;
  const intensity = Math.max(0.12, Math.min(1, value / max));
  return with_alpha(palette.accent, intensity);
}

export function HeatmapChart({ rows, series, fitMode, palette }) {
  const colors = palette || build_palette(null);
  const max = rows.reduce((best, row) => series.reduce((inner, key) => Math.max(inner, row[key] || 0), best), 0);
  return (
    <div style={{ overflowX: fitMode ? "hidden" : "auto" }}>
      <table className="border-collapse w-full" style={{ minWidth: fitMode ? undefined : Math.max(240, series.length * 72 + 120) }}>
        <thead>
          <tr>
            <th />
            {series.map((key) => {
              const column_total = rows.reduce((sum, row) => sum + (row[key] || 0), 0);
              return (
                <th key={key} className="px-1 pb-1 text-xs font-semibold text-center align-bottom" style={{ color: colors.muted, minWidth: 72 }}>
                  <span className="block break-words" style={{ maxWidth: 140 }}>{`${key} (${column_total})`}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="pr-2 py-0.5 text-xs text-right" style={{ color: colors.muted, maxWidth: 180 }}>
                <span className="block break-words">{row.label}</span>
              </td>
              {series.map((key) => (
                <td key={key} className="p-0.5">
                  <div
                    className="flex items-center justify-center text-xs font-semibold"
                    title={`${row.label} / ${key}: ${row[key] || 0}`}
                    style={{
                      height: 34,
                      transition: "background-color 600ms ease, color 600ms ease",
                      backgroundColor: heat_color(row[key] || 0, max, colors),
                      color: (row[key] || 0) / (max || 1) > 0.55 ? "#FFFFFF" : colors.text,
                    }}
                  >
                    {row[key] || 0}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Waffle: one hundred squares filled clockwise-by-row, each category
 * claiming its rounded share of cells; the legend carries the exact values.
 */
export function WaffleChart({ rows, palette }) {
  const colors = palette || build_palette(null);
  const total = rows.reduce((sum, row) => sum + (row.value || 0), 0) || 1;
  const cells = [];
  let used = 0;
  rows.forEach((row, index) => {
    const share = Math.round(((row.value || 0) / total) * 100);
    const count = index === rows.length - 1 ? Math.max(0, 100 - used) : Math.min(share, 100 - used);
    for (let step = 0; step < count; step += 1) cells.push(index);
    used += count;
  });
  while (cells.length < 100) cells.push(-1);

  const legend = (
    <LegendRow
      items={rows.map((row, index) => ({
        label: row.label,
        color: colors.color_for(row.label, index),
        value: `${Math.round(((row.value || 0) / total) * 100)}% (${row.value || 0})`,
      }))}
      palette={colors}
      square
    />
  );

  return (
    <LegendFrame position={colors.legend_position} legend={legend}>
      <div className="flex justify-center" style={{ minHeight: CHART_HEIGHT - 80 }}>
        <div className="grid flex-shrink-0" style={{ gridTemplateColumns: "repeat(10, 16px)", gap: 3 }}>
          {cells.map((series_index, cell_index) => (
            <div
              key={cell_index}
              style={{
                width: 16,
                height: 16,
                transition: "background-color 500ms ease",
                backgroundColor: series_index === -1 ? colors.empty : colors.color_for(rows[series_index].label, series_index),
              }}
            />
          ))}
        </div>
      </div>
    </LegendFrame>
  );
}
