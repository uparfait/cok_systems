import React from "react";
import { build_palette, with_alpha, readable_on } from "../appearance.js";
import { chart_density } from "./density.js";
import { fit_text_font } from "./labelDensity.jsx";
import { text_width } from "./chartLabels.jsx";
import { mix } from "./heatScale.js";
import { LegendRow, LegendFrame } from "./SeriesLegend.jsx";

// The smallest a number in a cell is written; a cell with no room for it carries its number in its tooltip only.
const MIN_CELL_FONT = 8;
// An axis label wraps, and a very long one ends in "..." after three lines; its title carries it in full.
const LABEL_CLAMP = { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden", overflowWrap: "anywhere" };

/**
 * The two grid-based renderers Recharts has no primitive for, drawn with
 * plain elements: the heatmap (rows x series matrix, color intensity
 * carries the value) and the waffle (one hundred cells, each one percent).
 * Both size their cells, fonts and label widths from the card's own width
 * (see density.js): a heatmap wider than its card scrolls INSIDE the card
 * rather than stretching it, and a waffle's squares shrink to fit. The
 * heatmap tints with the widget's number color; the waffle uses its
 * per-value colors; text follows the light or dark mode.
 */

function heat_color(value, max, palette) {
  if (!max || value <= 0) return palette.empty;
  const intensity = Math.max(0.12, Math.min(1, value / max));
  return with_alpha(palette.accent, intensity);
}

/** The ink that reads on a cell: against the tint the cell really shows over the card's own ground. */
function heat_ink(value, max, palette) {
  if (!max || value <= 0) return palette.text;
  const intensity = Math.max(0.12, Math.min(1, value / max));
  return readable_on(mix(palette.background_solid, palette.accent, intensity), null);
}

export function HeatmapChart({ rows, series, fitMode, palette, density, onItemClick }) {
  const colors = palette || build_palette(null);
  const size = density || chart_density();
  const max = rows.reduce((best, row) => series.reduce((inner, key) => Math.max(inner, row[key] || 0), best), 0);
  const label_width = Math.round(Math.max(56, Math.min(size.y_max, size.width * 0.28)));
  // Fitted to the card, every column takes an equal share of what is left
  // beside the row labels, so every column stays on the card on a phone
  // too; scrolling, a column keeps the width the card's density gives it.
  const cell_width = fitMode ? Math.max(12, Math.floor((size.width - label_width - 12) / Math.max(1, series.length))) : size.cell_px;
  const cell_height = Math.max(22, Math.round(size.cell_px / 2.2));
  const axis_font = Math.max(MIN_CELL_FONT, size.font);
  // Every cell writes its number at the largest size that fits it; only a
  // cell too small for the smallest size leaves it to the tooltip.
  const cell_label = (value) => {
    const text = colors.number_text(value);
    if (text_width(text, MIN_CELL_FONT) > cell_width - 4 || cell_height < MIN_CELL_FONT + 2) return null;
    return { text, font: fit_text_font(text, cell_width - 6, size.font, MIN_CELL_FONT) };
  };
  return (
    <div style={{ maxWidth: "100%", overflowX: fitMode ? "hidden" : "auto", overflowY: "auto", maxHeight: size.max_height }}>
      <table className="border-collapse w-full" style={{ minWidth: fitMode ? undefined : series.length * size.cell_px + label_width, tableLayout: fitMode ? "fixed" : undefined }}>
        <thead>
          <tr>
            <th style={{ width: label_width }} />
            {series.map((key) => {
              const column_total = rows.reduce((sum, row) => sum + (row[key] || 0), 0);
              const full = `${key} (${column_total})`;
              return (
                <th key={key} className="px-1 pb-1 font-semibold text-center align-bottom" title={full} style={{ color: colors.muted, minWidth: fitMode ? undefined : size.cell_px, width: fitMode ? cell_width : undefined, fontSize: axis_font }}>
                  <span style={LABEL_CLAMP}>{full}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="pr-2 py-0.5 text-right" title={row.label} style={{ color: colors.muted, width: label_width, maxWidth: label_width, fontSize: axis_font }}>
                <span style={LABEL_CLAMP}>{row.label}</span>
              </td>
              {series.map((key) => {
                const value = row[key] || 0;
                const label = cell_label(value);
                return (
                  <td key={key} className="p-0.5">
                    <div
                      className="flex items-center justify-center font-semibold"
                      title={`${row.label} / ${key}: ${value}`}
                      onClick={onItemClick ? () => onItemClick(row.label, key) : undefined}
                      style={{
                        cursor: onItemClick ? "pointer" : undefined,
                        height: cell_height,
                        fontSize: label ? label.font : MIN_CELL_FONT,
                        lineHeight: 1,
                        overflow: "hidden",
                        transition: "background-color 600ms ease, color 600ms ease",
                        backgroundColor: heat_color(value, max, colors),
                        color: heat_ink(value, max, colors),
                      }}
                    >
                      {label ? label.text : ""}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Waffle: one hundred squares filled row by row, each category claiming its
 * rounded share of cells; the legend carries the exact values. The square
 * size follows the card, so ten of them always fit across it.
 */
export function WaffleChart({ rows, palette, density }) {
  const colors = palette || build_palette(null);
  const size = density || chart_density();
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
  // Ten squares plus their gaps must fit the card, and stay tappable.
  const square = Math.max(8, Math.min(16, Math.floor((Math.min(size.width, 320) - 40) / 10) - 3));

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
    <LegendFrame position={colors.legend_position} density={size} legend={legend}>
      <div className="flex justify-center" style={{ minHeight: Math.max(120, size.height - 80) }}>
        <div className="grid flex-shrink-0" style={{ gridTemplateColumns: `repeat(10, ${square}px)`, gap: 3 }}>
          {cells.map((series_index, cell_index) => (
            <div
              key={cell_index}
              style={{
                width: square,
                height: square,
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
