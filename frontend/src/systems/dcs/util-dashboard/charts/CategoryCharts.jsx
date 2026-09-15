import React, { useId } from "react";
import { ResponsiveContainer, BarChart, Bar, Cell, ComposedChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from "recharts";
import { CHART_HEIGHT } from "./chartTheme.js";
import { build_palette } from "../appearance.js";
import { wrapped_tick, x_axis_height, y_axis_width, bar_row_height, chars_for_width } from "./chartLabels.jsx";
import { PatternDefs, pattern_fill, series_display } from "./patterns.jsx";
import { SplitLegend, LegendFrame } from "./SeriesLegend.jsx";

/**
 * Every category-comparison renderer: bar (horizontal), column (vertical),
 * lollipop, dot plot, grouped columns, stacked columns and the 100 percent
 * stacked variation. Every mark carries its own value label so nothing has
 * to be hovered to be read; category labels wrap onto several lines rather
 * than being cut. Colors come from the widget's palette - one per category
 * value or per series - and a third field (series_meta) draws as a texture
 * inside each series color. Marks grow in and glide to new values.
 */

const common_margin = { top: 18, right: 24, left: 0, bottom: 5 };
const horizontal_margin = { top: 12, right: 56, left: 0, bottom: 5 };
const Y_AXIS_MAX_PX = 240;
const X_LABEL_CHARS = 16;
// Marks grow in only on their first appearance; a silent refresh keeps
// them in place and just moves them to their new values.
const animation = (animate) => ({ isAnimationActive: animate !== false, animationDuration: 700, animationEasing: "ease-out" });

const show_value = (value) => (value ? value : "");
const value_label = (palette) => ({ fontSize: 11, fontWeight: 600, fill: palette.text });
const clicked_row = (entry) => (entry && entry.payload ? entry.payload : entry);
const labels_of = (rows) => rows.map((row) => row.label);
const value_cells = (rows, palette) => rows.map((row, index) => <Cell key={`${row.label}-${index}`} fill={palette.color_for(row.label, index)} />);

function HorizontalBars({ rows, onItemClick, palette, animate }) {
  const labels = labels_of(rows);
  const width = y_axis_width(labels, Y_AXIS_MAX_PX);
  const height = Math.max(CHART_HEIGHT, rows.length * bar_row_height(labels, Y_AXIS_MAX_PX, 34));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={horizontal_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} horizontal={false} />
        <XAxis type="number" tick={palette.tick} allowDecimals={false} stroke={palette.grid} />
        <YAxis type="category" dataKey="label" width={width} interval={0} stroke={palette.grid} tick={wrapped_tick(palette, chars_for_width(width), "end")} />
        <Tooltip contentStyle={palette.tooltip} />
        <Bar dataKey="value" {...animation(animate)} maxBarSize={22} cursor={onItemClick ? "pointer" : undefined} onClick={onItemClick ? (entry) => onItemClick(clicked_row(entry)) : undefined}>
          {value_cells(rows, palette)}
          <LabelList dataKey="value" position="right" formatter={show_value} style={value_label(palette)} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function VerticalColumns({ rows, onItemClick, palette, animate }) {
  const labels = labels_of(rows);
  const axis_height = x_axis_height(labels, X_LABEL_CHARS);
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT + axis_height - 30}>
      <BarChart data={rows} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
        <XAxis dataKey="label" interval={0} height={axis_height} stroke={palette.grid} tick={wrapped_tick(palette, X_LABEL_CHARS, "middle")} />
        <YAxis tick={palette.tick} allowDecimals={false} stroke={palette.grid} />
        <Tooltip contentStyle={palette.tooltip} />
        <Bar dataKey="value" {...animation(animate)} maxBarSize={40} cursor={onItemClick ? "pointer" : undefined} onClick={onItemClick ? (entry) => onItemClick(clicked_row(entry)) : undefined}>
          {value_cells(rows, palette)}
          <LabelList dataKey="value" position="top" formatter={show_value} style={value_label(palette)} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Lollipop: a hair-thin stick with a dot on top; the dot plot keeps only the dot. */
function LollipopOrDots({ rows, with_stick, palette, animate }) {
  const axis_height = x_axis_height(labels_of(rows), X_LABEL_CHARS);
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT + axis_height - 30}>
      <ComposedChart data={rows} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
        <XAxis dataKey="label" interval={0} height={axis_height} stroke={palette.grid} tick={wrapped_tick(palette, X_LABEL_CHARS, "middle")} />
        <YAxis tick={palette.tick} allowDecimals={false} stroke={palette.grid} />
        <Tooltip contentStyle={palette.tooltip} />
        {with_stick && (
          <Bar dataKey="value" barSize={3} {...animation(animate)}>
            {value_cells(rows, palette)}
          </Bar>
        )}
        <Scatter dataKey="value" {...animation(animate)}>
          {value_cells(rows, palette)}
          <LabelList dataKey="value" position="top" formatter={show_value} style={value_label(palette)} />
        </Scatter>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/**
 * Multi-series columns or bars: side by side (grouped), stacked, or stacked
 * to 100 percent (each row rescaled to its own total). A third field
 * (series_meta) textures each series inside its split color. The legend is
 * drawn by SeriesLegend in rows, where the appearance places it.
 */
function SeriesColumns({ rows, series, seriesMeta, mode, horizontal, palette, labels, animate }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const display = series_display(series, seriesMeta, palette);
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
  const totals = {};
  series.forEach((key) => {
    totals[key] = rows.reduce((sum, row) => sum + (row[key] || 0), 0);
  });
  const row_labels = labels_of(rows);
  const y_width = y_axis_width(row_labels, Y_AXIS_MAX_PX);
  const axis_height = x_axis_height(row_labels, X_LABEL_CHARS);
  const height = horizontal
    ? Math.max(CHART_HEIGHT, rows.length * bar_row_height(row_labels, Y_AXIS_MAX_PX, stacked ? 36 : Math.max(26, series.length * 18)))
    : CHART_HEIGHT + axis_height - 30;
  const split_colors = display.splits.map((split, index) => palette.color_for(split, index));

  const chart = (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={horizontal ? horizontal_margin : common_margin}>
        <PatternDefs uid={uid} colors={split_colors} patternCount={display.patterns.length} />
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={palette.tick} allowDecimals={mode === "stacked_100"} unit={mode === "stacked_100" ? "%" : undefined} stroke={palette.grid} />
            <YAxis type="category" dataKey="label" width={y_width} interval={0} stroke={palette.grid} tick={wrapped_tick(palette, chars_for_width(y_width), "end")} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" interval={0} height={axis_height} stroke={palette.grid} tick={wrapped_tick(palette, X_LABEL_CHARS, "middle")} />
            <YAxis tick={palette.tick} allowDecimals={mode === "stacked_100"} unit={mode === "stacked_100" ? "%" : undefined} stroke={palette.grid} />
          </>
        )}
        <Tooltip contentStyle={palette.tooltip} formatter={(value, name) => [value, display.items.find((item) => item.key === name)?.label || name]} />
        {display.items.map((item, index) => (
          <Bar key={item.key} dataKey={item.key} stackId={stacked ? "stack" : undefined} fill={pattern_fill(uid, item.split_index, item.pattern_index, item.color)} {...animation(animate)} maxBarSize={horizontal ? 22 : 40}>
            <LabelList
              dataKey={item.key}
              position={stacked ? "center" : horizontal ? "right" : "top"}
              formatter={(value) => (value ? (mode === "stacked_100" ? `${value}%` : value) : "")}
              style={stacked ? { fontSize: 10, fontWeight: 600, fill: "#FFFFFF" } : { ...value_label(palette), fontSize: 10 }}
            />
            {mode === "stacked" && index === display.items.length - 1 && (
              <LabelList dataKey={(entry) => series.reduce((sum, key) => sum + (entry[key] || 0), 0)} position={horizontal ? "right" : "top"} formatter={show_value} style={value_label(palette)} />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <LegendFrame position={palette.legend_position} legend={<SplitLegend display={display} totals={totals} palette={palette} splitTitle={labels && labels.split} patternTitle={labels && labels.pattern} />}>
      {chart}
    </LegendFrame>
  );
}

const MULTI_SERIES_TYPES = {
  grouped_column: { mode: "grouped", horizontal: false },
  stacked_column: { mode: "stacked", horizontal: false },
  stacked_100: { mode: "stacked_100", horizontal: false },
  grouped_bar: { mode: "grouped", horizontal: true },
  stacked_bar: { mode: "stacked", horizontal: true },
  stacked_bar_100: { mode: "stacked_100", horizontal: true },
};

export default function CategoryCharts({ chartType, rows, series, seriesMeta, onItemClick, palette, legendLabels, animate }) {
  const colors = palette || build_palette(null);
  if (chartType === "bar") return <HorizontalBars rows={rows} onItemClick={onItemClick} palette={colors} animate={animate} />;
  if (chartType === "column") return <VerticalColumns rows={rows} onItemClick={onItemClick} palette={colors} animate={animate} />;
  if (chartType === "lollipop") return <LollipopOrDots rows={rows} with_stick palette={colors} animate={animate} />;
  if (chartType === "dot_plot") return <LollipopOrDots rows={rows} with_stick={false} palette={colors} animate={animate} />;
  const multi = MULTI_SERIES_TYPES[chartType];
  if (multi) return <SeriesColumns rows={rows} series={series} seriesMeta={seriesMeta} mode={multi.mode} horizontal={multi.horizontal} palette={colors} labels={legendLabels} animate={animate} />;
  return <VerticalColumns rows={rows} onItemClick={onItemClick} palette={colors} animate={animate} />;
}
