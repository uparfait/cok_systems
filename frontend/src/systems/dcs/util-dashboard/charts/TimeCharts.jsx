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
import { CHART_HEIGHT } from "./chartTheme.js";
import { build_palette } from "../appearance.js";

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
 * out its axis labels instead. A single series draws in the widget's
 * number color, split series in their own value colors.
 */
export default function TimeCharts({ chartType, rows, series, fitMode, palette }) {
  const colors = palette || build_palette(null);
  const tick_interval = fitMode ? "preserveStartEnd" : 0;
  const accent = colors.accent;
  const chart =
    chartType === "area" ? (
      <AreaChart data={rows} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="label" tick={colors.tick} interval={tick_interval} angle={-30} textAnchor="end" height={54} stroke={colors.grid} />
        <YAxis tick={colors.tick} allowDecimals={false} stroke={colors.grid} />
        <Tooltip contentStyle={colors.tooltip} />
        <Area type="monotone" dataKey="value" stroke={accent} fill={accent} fillOpacity={0.18} strokeWidth={2.5} isAnimationActive={false}>
          <LabelList dataKey="value" position="top" formatter={show_value} style={{ fontSize: 11, fontWeight: 600, fill: accent }} isAnimationActive={false} />
        </Area>
      </AreaChart>
    ) : (
      <LineChart data={rows} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="label" tick={colors.tick} interval={tick_interval} angle={-30} textAnchor="end" height={54} stroke={colors.grid} />
        <YAxis tick={colors.tick} allowDecimals={false} stroke={colors.grid} />
        <Tooltip contentStyle={colors.tooltip} />
        {series && series.length > 0 ? (
          <>
            <Legend
              wrapperStyle={colors.legend_style}
              iconType="circle"
              iconSize={9}
              formatter={(value) => <span style={{ color: colors.text }}>{`${value} (${rows.reduce((sum, row) => sum + (row[value] || 0), 0)})`}</span>}
            />
            {series.map((key, index) => {
              const color = colors.color_for(key, index);
              return (
                <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2.5} dot={{ r: 2.5, fill: color }} isAnimationActive={false}>
                  <LabelList dataKey={key} position="top" formatter={show_value} style={{ fontSize: 10, fontWeight: 600, fill: color }} isAnimationActive={false} />
                </Line>
              );
            })}
          </>
        ) : (
          <Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2.5} dot={{ r: 2.5, fill: accent }} isAnimationActive={false}>
            <LabelList dataKey="value" position="top" formatter={show_value} style={{ fontSize: 11, fontWeight: 600, fill: accent }} isAnimationActive={false} />
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
