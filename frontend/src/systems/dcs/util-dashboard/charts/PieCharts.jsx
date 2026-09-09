import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { series_color, TOOLTIP_STYLE, CHART_HEIGHT } from "./chartTheme.js";

/**
 * Pie and donut renderers. Slices carry their value and share directly, and
 * the legend is drawn as our own VERTICAL list under the chart - one row
 * per slice with a round color marker - so long labels wrap over the full
 * card width instead of squeezing the circle or overflowing sideways. The
 * donut shows the total in its hole.
 */
export default function PieCharts({ chartType, rows, totalLabel, onItemClick }) {
  const total = rows.reduce((sum, row) => sum + (row.value || 0), 0);
  const is_donut = chartType === "donut";
  const chart_height = CHART_HEIGHT - 60;
  const handle_click = onItemClick ? (entry) => onItemClick(entry && entry.payload ? entry.payload : entry) : undefined;

  return (
    <div>
      <div className="relative" style={{ height: chart_height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="label"
              innerRadius={is_donut ? "55%" : 0}
              outerRadius="80%"
              paddingAngle={rows.length > 1 ? 2 : 0}
              isAnimationActive={false}
              label={({ value, percent }) => `${value} (${Math.round(percent * 100)}%)`}
              cursor={handle_click ? "pointer" : undefined}
              onClick={handle_click}
            >
              {rows.map((row, index) => (
                <Cell key={row.label} fill={series_color(index)} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        {is_donut && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-bold" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif", fontSize: 22 }}>
              {total}
            </span>
            <span className="text-xs" style={{ color: "#9E9E9E" }}>
              {totalLabel}
            </span>
          </div>
        )}
      </div>

      <ul className="mt-2 space-y-1" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {rows.map((row, index) => (
          <li key={row.label} className="flex items-start gap-2 text-xs" style={{ color: "#333333" }}>
            <span
              className="flex-shrink-0"
              style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: series_color(index), marginTop: 3 }}
            />
            <span className="min-w-0 break-words">{row.label}</span>
            <span className="flex-shrink-0 font-semibold" style={{ color: "#555555" }}>
              {row.value || 0}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
