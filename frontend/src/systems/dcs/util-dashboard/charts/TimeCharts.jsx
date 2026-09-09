import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { PRIMARY, series_color, TOOLTIP_STYLE, AXIS_TICK, GRID_STROKE, CHART_HEIGHT } from "./chartTheme.js";

const common_margin = { top: 12, right: 16, left: 0, bottom: 5 };
const MIN_POINT_WIDTH_PX = 44;

/**
 * Time-series renderers: line (single or multi series) and area. Wide
 * ranges scroll horizontally inside the widget instead of squeezing their
 * labels into illegibility, the same track pattern as the submissions
 * chart.
 */
export default function TimeCharts({ chartType, rows, series }) {
  const chart =
    chartType === "area" ? (
      <AreaChart data={rows} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="label" tick={AXIS_TICK} interval={0} angle={-30} textAnchor="end" height={54} />
        <YAxis tick={AXIS_TICK} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Area type="monotone" dataKey="value" stroke={PRIMARY} fill={PRIMARY} fillOpacity={0.18} strokeWidth={2.5} isAnimationActive={false} />
      </AreaChart>
    ) : (
      <LineChart data={rows} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="label" tick={AXIS_TICK} interval={0} angle={-30} textAnchor="end" height={54} />
        <YAxis tick={AXIS_TICK} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        {series && series.length > 0 ? (
          <>
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={series_color(index)}
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: series_color(index) }}
                isAnimationActive={false}
              />
            ))}
          </>
        ) : (
          <Line type="monotone" dataKey="value" stroke={PRIMARY} strokeWidth={2.5} dot={{ r: 2.5, fill: PRIMARY }} isAnimationActive={false} />
        )}
      </LineChart>
    );

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <div style={{ minWidth: Math.max(280, rows.length * MIN_POINT_WIDTH_PX), height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
