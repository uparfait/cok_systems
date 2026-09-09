import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { series_color, TOOLTIP_STYLE, CHART_HEIGHT } from "./chartTheme.js";

/**
 * Pie and donut renderers. The backend already capped the slices (six at
 * most, tail folded into Other), so these never render an unreadable fan of
 * wedges. The donut shows the total in its hole.
 */
export default function PieCharts({ chartType, rows, totalLabel }) {
  const total = rows.reduce((sum, row) => sum + (row.value || 0), 0);
  const is_donut = chartType === "donut";

  return (
    <div className="relative" style={{ height: CHART_HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="label"
            innerRadius={is_donut ? "55%" : 0}
            outerRadius="82%"
            paddingAngle={rows.length > 1 ? 2 : 0}
            isAnimationActive={false}
            label={({ percent }) => `${Math.round(percent * 100)}%`}
          >
            {rows.map((row, index) => (
              <Cell key={row.label} fill={series_color(index)} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
      {is_donut && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ paddingBottom: 24 }}
        >
          <span className="font-bold" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif", fontSize: 22 }}>
            {total}
          </span>
          <span className="text-xs" style={{ color: "#9E9E9E" }}>
            {totalLabel}
          </span>
        </div>
      )}
    </div>
  );
}
