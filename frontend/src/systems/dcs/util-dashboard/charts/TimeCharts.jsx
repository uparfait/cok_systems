import React from "react";
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from "recharts";
import { CHART_HEIGHT } from "./chartTheme.js";
import { build_palette } from "../appearance.js";
import { wrapped_tick, x_axis_height } from "./chartLabels.jsx";
import { LegendRow, LegendFrame } from "./SeriesLegend.jsx";

const common_margin = { top: 20, right: 20, left: 0, bottom: 5 };
const MIN_POINT_WIDTH_PX = 44;
const X_LABEL_CHARS = 14;
const ANIMATION = { isAnimationActive: true, animationDuration: 700, animationEasing: "ease-out" };

const show_value = (value) => (value ? value : "");

/**
 * Time-series renderers: line (single or multi series) and area. Wide
 * ranges scroll horizontally inside the widget instead of squeezing their
 * labels - except in fit-to-screen mode, where the chart compresses to the
 * card and thins its labels. Labels wrap rather than being cut. A single
 * series draws in the widget's number color, split series in their own
 * value colors with the shared row legend placed by the appearance.
 */
export default function TimeCharts({ chartType, rows, series, fitMode, palette }) {
  const colors = palette || build_palette(null);
  const tick_interval = fitMode ? "preserveStartEnd" : 0;
  const accent = colors.accent;
  const axis_height = x_axis_height(rows.map((row) => row.label), X_LABEL_CHARS);
  const has_series = series && series.length > 0;
  const chart =
    chartType === "area" ? (
      <AreaChart data={rows} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="label" interval={tick_interval} height={axis_height} stroke={colors.grid} tick={wrapped_tick(colors, X_LABEL_CHARS, "middle")} />
        <YAxis tick={colors.tick} allowDecimals={false} stroke={colors.grid} />
        <Tooltip contentStyle={colors.tooltip} />
        <Area type="monotone" dataKey="value" stroke={accent} fill={accent} fillOpacity={0.18} strokeWidth={2.5} {...ANIMATION}>
          <LabelList dataKey="value" position="top" formatter={show_value} style={{ fontSize: 11, fontWeight: 600, fill: accent }} />
        </Area>
      </AreaChart>
    ) : (
      <LineChart data={rows} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="label" interval={tick_interval} height={axis_height} stroke={colors.grid} tick={wrapped_tick(colors, X_LABEL_CHARS, "middle")} />
        <YAxis tick={colors.tick} allowDecimals={false} stroke={colors.grid} />
        <Tooltip contentStyle={colors.tooltip} />
        {has_series ? (
          series.map((key, index) => {
            const color = colors.color_for(key, index);
            return (
              <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2.5} dot={{ r: 2.5, fill: color }} {...ANIMATION}>
                <LabelList dataKey={key} position="top" formatter={show_value} style={{ fontSize: 10, fontWeight: 600, fill: color }} />
              </Line>
            );
          })
        ) : (
          <Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2.5} dot={{ r: 2.5, fill: accent }} {...ANIMATION}>
            <LabelList dataKey="value" position="top" formatter={show_value} style={{ fontSize: 11, fontWeight: 600, fill: accent }} />
          </Line>
        )}
      </LineChart>
    );

  const legend = has_series ? (
    <LegendRow items={series.map((key, index) => ({ label: key, color: colors.color_for(key, index), value: rows.reduce((sum, row) => sum + (row[key] || 0), 0) }))} palette={colors} />
  ) : null;

  return (
    <LegendFrame position={colors.legend_position} legend={legend}>
      <div style={{ width: "100%", overflowX: fitMode ? "hidden" : "auto" }}>
        <div style={{ minWidth: fitMode ? undefined : Math.max(280, rows.length * MIN_POINT_WIDTH_PX), height: CHART_HEIGHT + axis_height - 30 }}>
          <ResponsiveContainer width="100%" height="100%">
            {chart}
          </ResponsiveContainer>
        </div>
      </div>
    </LegendFrame>
  );
}
