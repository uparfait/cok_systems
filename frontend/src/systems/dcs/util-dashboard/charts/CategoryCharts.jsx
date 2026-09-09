import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";
import { PRIMARY, series_color, TOOLTIP_STYLE, AXIS_TICK, GRID_STROKE, CHART_HEIGHT } from "./chartTheme.js";

/**
 * Every category-comparison renderer: bar (horizontal), column (vertical),
 * lollipop, dot plot, grouped columns, stacked columns and the 100 percent
 * stacked variation. Every mark carries its own value label so nothing has
 * to be hovered to be read. Animation stays off everywhere - the dashboard
 * refreshes silently and replayed entrance animations read as flicker.
 */

const common_margin = { top: 18, right: 24, left: 0, bottom: 5 };

// Zero labels are noise - only real values are printed on the marks.
const show_value = (value) => (value ? value : "");
const VALUE_LABEL = { fontSize: 11, fontWeight: 600, fill: "#333333" };

function HorizontalBars({ rows }) {
  const height = Math.max(CHART_HEIGHT, rows.length * 34);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={AXIS_TICK} width={110} interval={0} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="value" fill={PRIMARY} isAnimationActive={false} maxBarSize={22}>
          <LabelList dataKey="value" position="right" formatter={show_value} style={VALUE_LABEL} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function VerticalColumns({ rows }) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={rows} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} interval={0} angle={-25} textAnchor="end" height={54} />
        <YAxis tick={AXIS_TICK} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="value" fill={PRIMARY} isAnimationActive={false} maxBarSize={40}>
          <LabelList dataKey="value" position="top" formatter={show_value} style={VALUE_LABEL} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Lollipop: a hair-thin column carrying the stick, with a scatter dot as
 * the candy on top. The dot plot drops the stick and keeps only the dot.
 */
function LollipopOrDots({ rows, with_stick }) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <ComposedChart data={rows} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} interval={0} angle={-25} textAnchor="end" height={54} />
        <YAxis tick={AXIS_TICK} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        {with_stick && <Bar dataKey="value" fill={PRIMARY} barSize={3} isAnimationActive={false} />}
        <Scatter dataKey="value" fill={PRIMARY} isAnimationActive={false}>
          <LabelList dataKey="value" position="top" formatter={show_value} style={VALUE_LABEL} />
        </Scatter>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/**
 * Multi-series columns: side by side (grouped), stacked, or stacked to 100
 * percent (each row rescaled to its own total before rendering).
 */
function SeriesColumns({ rows, series, mode }) {
  const data =
    mode === "stacked_100"
      ? rows.map((row) => {
          const total = series.reduce((sum, key) => sum + (row[key] || 0), 0) || 1;
          const scaled = { label: row.label };
          series.forEach((key) => {
            scaled[key] = Math.round(((row[key] || 0) / total) * 1000) / 10;
          });
          return scaled;
        })
      : rows;
  const stacked = mode === "stacked" || mode === "stacked_100";
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} interval={0} angle={-25} textAnchor="end" height={54} />
        <YAxis tick={AXIS_TICK} allowDecimals={mode === "stacked_100"} unit={mode === "stacked_100" ? "%" : undefined} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={9} />
        {series.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            stackId={stacked ? "stack" : undefined}
            fill={series_color(index)}
            isAnimationActive={false}
            maxBarSize={40}
          >
            <LabelList
              dataKey={key}
              position={stacked ? "center" : "top"}
              formatter={(value) => (value ? (mode === "stacked_100" ? `${value}%` : value) : "")}
              style={stacked ? { fontSize: 10, fontWeight: 600, fill: "#FFFFFF" } : { ...VALUE_LABEL, fontSize: 10 }}
            />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function CategoryCharts({ chartType, rows, series }) {
  if (chartType === "bar") return <HorizontalBars rows={rows} />;
  if (chartType === "column") return <VerticalColumns rows={rows} />;
  if (chartType === "lollipop") return <LollipopOrDots rows={rows} with_stick />;
  if (chartType === "dot_plot") return <LollipopOrDots rows={rows} with_stick={false} />;
  if (chartType === "grouped_column") return <SeriesColumns rows={rows} series={series} mode="grouped" />;
  if (chartType === "stacked_column") return <SeriesColumns rows={rows} series={series} mode="stacked" />;
  if (chartType === "stacked_100") return <SeriesColumns rows={rows} series={series} mode="stacked_100" />;
  return <VerticalColumns rows={rows} />;
}
