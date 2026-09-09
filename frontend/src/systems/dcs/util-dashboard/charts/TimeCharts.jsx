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
  LabelList,
} from "recharts";
import { PRIMARY, series_color, TOOLTIP_STYLE, AXIS_TICK, GRID_STROKE, CHART_HEIGHT } from "./chartTheme.js";

const common_margin = { top: 20, right: 20, left: 0, bottom: 5 };
const MIN_POINT_WIDTH_PX = 44;

// Zero labels are noise - only real values are printed on the points.
const show_value = (value) => (value ? value : "");

/**
 * Time-series renderers: line (single or multi series) and area. Wide
 * ranges scroll horizontally inside the widget instead of squeezing their
 * labels into illegibility, the same track pattern as the submissions
 * chart - EXCEPT in fit-to-screen mode, where nothing may hide behind a
 * scrollbar: the chart then compresses to the card's own width and thins
 * out its axis labels instead.
 */
export default function TimeCharts({ chartType, rows, series, fitMode }) {
  const tick_interval = fitMode ? "preserveStartEnd" : 0;
  const chart =
    chartType === "area" ? (
      <AreaChart data={rows} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="label" tick={AXIS_TICK} interval={tick_interval} angle={-30} textAnchor="end" height={54} />
        <YAxis tick={AXIS_TICK} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Area type="monotone" dataKey="value" stroke={PRIMARY} fill={PRIMARY} fillOpacity={0.18} strokeWidth={2.5} isAnimationActive={false}>
          <LabelList dataKey="value" position="top" formatter={show_value} style={{ fontSize: 11, fontWeight: 600, fill: PRIMARY }} isAnimationActive={false} />
        </Area>
      </AreaChart>
    ) : (
      <LineChart data={rows} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="label" tick={AXIS_TICK} interval={tick_interval} angle={-30} textAnchor="end" height={54} />
        <YAxis tick={AXIS_TICK} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        {series && series.length > 0 ? (
          <>
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconType="circle"
              iconSize={9}
              formatter={(value) => `${value} (${rows.reduce((sum, row) => sum + (row[value] || 0), 0)})`}
            />
            {series.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={series_color(index)}
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: series_color(index) }}
                isAnimationActive={false}
              >
                <LabelList dataKey={key} position="top" formatter={show_value} style={{ fontSize: 10, fontWeight: 600, fill: series_color(index) }} isAnimationActive={false} />
              </Line>
            ))}
          </>
        ) : (
          <Line type="monotone" dataKey="value" stroke={PRIMARY} strokeWidth={2.5} dot={{ r: 2.5, fill: PRIMARY }} isAnimationActive={false}>
            <LabelList dataKey="value" position="top" formatter={show_value} style={{ fontSize: 11, fontWeight: 600, fill: PRIMARY }} isAnimationActive={false} />
          </Line>
        )}
      </LineChart>
    );

  return (
    <div style={{ width: "100%", overflowX: fitMode ? "hidden" : "auto" }}>
      <div style={{ minWidth: fitMode ? undefined : Math.max(280, rows.length * MIN_POINT_WIDTH_PX), height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
