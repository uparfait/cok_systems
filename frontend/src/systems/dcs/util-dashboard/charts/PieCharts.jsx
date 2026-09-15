import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { CHART_HEIGHT } from "./chartTheme.js";
import { build_palette } from "../appearance.js";
import { LegendRow, LegendFrame } from "./SeriesLegend.jsx";

/**
 * Pie and donut renderers. Slices carry their value and share directly; the
 * legend flows in rows (full labels, never cut) where the appearance places
 * it. The donut shows the total in its hole. Slice colors follow the
 * widget's per-value colors, text its light or dark mode.
 */
export default function PieCharts({ chartType, rows, totalLabel, onItemClick, palette, animate }) {
  const colors = palette || build_palette(null);
  const total = rows.reduce((sum, row) => sum + (row.value || 0), 0);
  const is_donut = chartType === "donut";
  const chart_height = CHART_HEIGHT - 60;
  const handle_click = onItemClick ? (entry) => onItemClick(entry && entry.payload ? entry.payload : entry) : undefined;

  const legend = <LegendRow items={rows.map((row, index) => ({ label: row.label, color: colors.color_for(row.label, index), value: row.value || 0 }))} palette={colors} />;

  return (
    <LegendFrame position={colors.legend_position} legend={legend}>
      <div className="relative" style={{ height: chart_height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="label"
              innerRadius={is_donut ? "55%" : 0}
              outerRadius="66%"
              paddingAngle={rows.length > 1 ? 2 : 0}
              isAnimationActive={animate !== false}
              animationDuration={700}
              animationEasing="ease-out"
              label={({ value, percent }) => `${value} (${Math.round(percent * 100)}%)`}
              labelLine={{ strokeWidth: 1 }}
              stroke={colors.background}
              cursor={handle_click ? "pointer" : undefined}
              onClick={handle_click}
            >
              {rows.map((row, index) => (
                <Cell key={row.label} fill={colors.color_for(row.label, index)} />
              ))}
            </Pie>
            <Tooltip contentStyle={colors.tooltip} />
          </PieChart>
        </ResponsiveContainer>
        {is_donut && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-bold" style={{ color: colors.number, fontFamily: "'Montserrat', sans-serif", fontSize: 22 }}>
              {total}
            </span>
            <span className="text-xs" style={{ color: colors.muted }}>
              {totalLabel}
            </span>
          </div>
        )}
      </div>
    </LegendFrame>
  );
}
