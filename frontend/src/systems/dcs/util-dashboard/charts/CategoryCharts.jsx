import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ComposedChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";
import { CHART_HEIGHT } from "./chartTheme.js";
import { build_palette } from "../appearance.js";

/**
 * Every category-comparison renderer: bar (horizontal), column (vertical),
 * lollipop, dot plot, grouped columns, stacked columns and the 100 percent
 * stacked variation. Every mark carries its own value label so nothing has
 * to be hovered to be read. Colors come from the widget's palette: one
 * color per category value (or per series), text and grid following the
 * widget's light or dark mode. Animation stays off everywhere - the
 * dashboard refreshes silently and replayed entrance animations read as
 * flicker.
 */

const common_margin = { top: 18, right: 24, left: 0, bottom: 5 };

// Zero labels are noise - only real values are printed on the marks.
const show_value = (value) => (value ? value : "");
const value_label = (palette) => ({ fontSize: 11, fontWeight: 600, fill: palette.text });

// Recharts hands the clicked mark with its row under payload - normalized
// here so callers always receive the plain {label, value} row.
const clicked_row = (entry) => (entry && entry.payload ? entry.payload : entry);

const value_cells = (rows, palette) => rows.map((row, index) => <Cell key={`${row.label}-${index}`} fill={palette.color_for(row.label, index)} />);

function HorizontalBars({ rows, onItemClick, palette }) {
  const height = Math.max(CHART_HEIGHT, rows.length * 34);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} horizontal={false} />
        <XAxis type="number" tick={palette.tick} allowDecimals={false} stroke={palette.grid} />
        <YAxis type="category" dataKey="label" tick={palette.tick} width={110} interval={0} stroke={palette.grid} />
        <Tooltip contentStyle={palette.tooltip} />
        <Bar
          dataKey="value"
          isAnimationActive={false}
          maxBarSize={22}
          cursor={onItemClick ? "pointer" : undefined}
          onClick={onItemClick ? (entry) => onItemClick(clicked_row(entry)) : undefined}
        >
          {value_cells(rows, palette)}
          <LabelList dataKey="value" position="right" formatter={show_value} style={value_label(palette)} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function VerticalColumns({ rows, onItemClick, palette }) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={rows} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
        <XAxis dataKey="label" tick={palette.tick} interval={0} angle={-25} textAnchor="end" height={54} stroke={palette.grid} />
        <YAxis tick={palette.tick} allowDecimals={false} stroke={palette.grid} />
        <Tooltip contentStyle={palette.tooltip} />
        <Bar
          dataKey="value"
          isAnimationActive={false}
          maxBarSize={40}
          cursor={onItemClick ? "pointer" : undefined}
          onClick={onItemClick ? (entry) => onItemClick(clicked_row(entry)) : undefined}
        >
          {value_cells(rows, palette)}
          <LabelList dataKey="value" position="top" formatter={show_value} style={value_label(palette)} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Lollipop: a hair-thin column carrying the stick, with a scatter dot as
 * the candy on top. The dot plot drops the stick and keeps only the dot.
 */
function LollipopOrDots({ rows, with_stick, palette }) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <ComposedChart data={rows} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
        <XAxis dataKey="label" tick={palette.tick} interval={0} angle={-25} textAnchor="end" height={54} stroke={palette.grid} />
        <YAxis tick={palette.tick} allowDecimals={false} stroke={palette.grid} />
        <Tooltip contentStyle={palette.tooltip} />
        {with_stick && (
          <Bar dataKey="value" barSize={3} isAnimationActive={false}>
            {value_cells(rows, palette)}
          </Bar>
        )}
        <Scatter dataKey="value" isAnimationActive={false}>
          {value_cells(rows, palette)}
          <LabelList dataKey="value" position="top" formatter={show_value} style={value_label(palette)} />
        </Scatter>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/**
 * Multi-series columns or bars: side by side (grouped), stacked, or stacked
 * to 100 percent (each row rescaled to its own total before rendering).
 * horizontal flips the whole chart into bars growing rightward.
 */
function SeriesColumns({ rows, series, mode, horizontal, palette }) {
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
  // Each legend entry carries its own category's grand total across every
  // bar - computed from the RAW rows, never the 100-percent-scaled copies.
  const series_totals = {};
  series.forEach((key) => {
    series_totals[key] = rows.reduce((sum, row) => sum + (row[key] || 0), 0);
  });
  const height = horizontal
    ? Math.max(CHART_HEIGHT, rows.length * (stacked ? 36 : Math.max(26, series.length * 18)))
    : CHART_HEIGHT;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={palette.tick} allowDecimals={mode === "stacked_100"} unit={mode === "stacked_100" ? "%" : undefined} stroke={palette.grid} />
            <YAxis type="category" dataKey="label" tick={palette.tick} width={110} interval={0} stroke={palette.grid} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" tick={palette.tick} interval={0} angle={-25} textAnchor="end" height={54} stroke={palette.grid} />
            <YAxis tick={palette.tick} allowDecimals={mode === "stacked_100"} unit={mode === "stacked_100" ? "%" : undefined} stroke={palette.grid} />
          </>
        )}
        <Tooltip contentStyle={palette.tooltip} />
        <Legend
          wrapperStyle={palette.legend_style}
          iconType="circle"
          iconSize={9}
          formatter={(value) => <span style={{ color: palette.text }}>{`${value} (${series_totals[value] === undefined ? 0 : series_totals[value]})`}</span>}
        />
        {series.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            stackId={stacked ? "stack" : undefined}
            fill={palette.color_for(key, index)}
            isAnimationActive={false}
            maxBarSize={horizontal ? 22 : 40}
          >
            <LabelList
              dataKey={key}
              position={stacked ? "center" : horizontal ? "right" : "top"}
              formatter={(value) => (value ? (mode === "stacked_100" ? `${value}%` : value) : "")}
              style={stacked ? { fontSize: 10, fontWeight: 600, fill: "#FFFFFF" } : { ...value_label(palette), fontSize: 10 }}
            />
            {mode === "stacked" && index === series.length - 1 && (
              // The OVERALL total of each stack, printed once at its end.
              <LabelList
                dataKey={(entry) => series.reduce((sum, series_key) => sum + (entry[series_key] || 0), 0)}
                position={horizontal ? "right" : "top"}
                formatter={show_value}
                style={value_label(palette)}
              />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Multi-series types map onto one renderer: a mode plus an orientation.
const MULTI_SERIES_TYPES = {
  grouped_column: { mode: "grouped", horizontal: false },
  stacked_column: { mode: "stacked", horizontal: false },
  stacked_100: { mode: "stacked_100", horizontal: false },
  grouped_bar: { mode: "grouped", horizontal: true },
  stacked_bar: { mode: "stacked", horizontal: true },
  stacked_bar_100: { mode: "stacked_100", horizontal: true },
};

export default function CategoryCharts({ chartType, rows, series, onItemClick, palette }) {
  const colors = palette || build_palette(null);
  if (chartType === "bar") return <HorizontalBars rows={rows} onItemClick={onItemClick} palette={colors} />;
  if (chartType === "column") return <VerticalColumns rows={rows} onItemClick={onItemClick} palette={colors} />;
  if (chartType === "lollipop") return <LollipopOrDots rows={rows} with_stick palette={colors} />;
  if (chartType === "dot_plot") return <LollipopOrDots rows={rows} with_stick={false} palette={colors} />;
  const multi = MULTI_SERIES_TYPES[chartType];
  if (multi) return <SeriesColumns rows={rows} series={series} mode={multi.mode} horizontal={multi.horizontal} palette={colors} />;
  return <VerticalColumns rows={rows} onItemClick={onItemClick} palette={colors} />;
}
