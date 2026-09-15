import React, { useId } from "react";
import { ResponsiveContainer, BarChart, Bar, Cell, ComposedChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from "recharts";
import { build_palette } from "../appearance.js";
import { wrapped_tick, x_axis_height, y_axis_width, bar_row_height, chars_for_width } from "./chartLabels.jsx";
import { chart_density, tick_style, value_style } from "./density.js";
import { PatternDefs, pattern_fill, series_display } from "./patterns.jsx";
import { SplitLegend, LegendFrame } from "./SeriesLegend.jsx";

/**
 * Every category-comparison renderer: bar (horizontal), column (vertical),
 * lollipop, dot plot, grouped columns, stacked columns and the 100 percent
 * stacked variation. Category labels wrap onto several lines rather than
 * being cut, and every mark carries its value - unless the card is too
 * narrow to read one, in which case the value stays in the tooltip.
 * Everything is sized from the card's own width (see density.js), so a
 * small card draws a small chart instead of stretching its card. Colors
 * come from the widget's palette - one per category value or per series -
 * and a third field (series_meta) draws as a texture inside each series
 * color. Marks grow in and glide to new values.
 */

const common_margin = { top: 18, right: 18, left: 0, bottom: 5 };
const horizontal_margin = { top: 12, right: 44, left: 0, bottom: 5 };
// Marks grow in only on their first appearance; a silent refresh keeps
// them in place and just moves them to their new values.
const animation = (animate) => ({ isAnimationActive: animate !== false, animationDuration: 700, animationEasing: "ease-out" });

const show_value = (value) => (value ? value : "");
const clicked_row = (entry) => (entry && entry.payload ? entry.payload : entry);
const labels_of = (rows) => rows.map((row) => row.label);
const value_cells = (rows, palette) => rows.map((row, index) => <Cell key={`${row.label}-${index}`} fill={palette.color_for(row.label, index)} />);

/** A value written on a mark, left out entirely when the card is too narrow. */
function ValueLabels({ density, palette, dataKey, position, formatter, size }) {
  if (!density.show_values) return null;
  return <LabelList dataKey={dataKey} position={position} formatter={formatter || show_value} style={value_style(palette, density, size)} />;
}

function HorizontalBars({ rows, onItemClick, palette, animate, density }) {
  const labels = labels_of(rows);
  const width = y_axis_width(labels, density.y_max);
  const height = Math.max(density.height, rows.length * bar_row_height(labels, density.y_max, density.row_base));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={density.show_values ? horizontal_margin : common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} horizontal={false} />
        <XAxis type="number" tick={tick_style(palette, density)} allowDecimals={false} stroke={palette.grid} />
        <YAxis type="category" dataKey="label" width={width} interval={0} stroke={palette.grid} tick={wrapped_tick(palette, chars_for_width(width), "end", density.font)} />
        <Tooltip contentStyle={palette.tooltip} />
        <Bar dataKey="value" {...animation(animate)} maxBarSize={density.bar} cursor={onItemClick ? "pointer" : undefined} onClick={onItemClick ? (entry) => onItemClick(clicked_row(entry)) : undefined}>
          {value_cells(rows, palette)}
          <ValueLabels density={density} palette={palette} dataKey="value" position="right" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function VerticalColumns({ rows, onItemClick, palette, animate, density }) {
  const labels = labels_of(rows);
  const axis_height = x_axis_height(labels, density.x_chars);
  return (
    <ResponsiveContainer width="100%" height={density.height + axis_height - 30}>
      <BarChart data={rows} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
        <XAxis dataKey="label" interval={0} height={axis_height} stroke={palette.grid} tick={wrapped_tick(palette, density.x_chars, "middle", density.font)} />
        <YAxis tick={tick_style(palette, density)} allowDecimals={false} stroke={palette.grid} width={density.font * 3} />
        <Tooltip contentStyle={palette.tooltip} />
        <Bar dataKey="value" {...animation(animate)} maxBarSize={density.column_bar} cursor={onItemClick ? "pointer" : undefined} onClick={onItemClick ? (entry) => onItemClick(clicked_row(entry)) : undefined}>
          {value_cells(rows, palette)}
          <ValueLabels density={density} palette={palette} dataKey="value" position="top" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Lollipop: a hair-thin stick with a dot on top; the dot plot keeps only the dot. */
function LollipopOrDots({ rows, with_stick, palette, animate, density }) {
  const axis_height = x_axis_height(labels_of(rows), density.x_chars);
  return (
    <ResponsiveContainer width="100%" height={density.height + axis_height - 30}>
      <ComposedChart data={rows} margin={common_margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
        <XAxis dataKey="label" interval={0} height={axis_height} stroke={palette.grid} tick={wrapped_tick(palette, density.x_chars, "middle", density.font)} />
        <YAxis tick={tick_style(palette, density)} allowDecimals={false} stroke={palette.grid} width={density.font * 3} />
        <Tooltip contentStyle={palette.tooltip} />
        {with_stick && (
          <Bar dataKey="value" barSize={3} {...animation(animate)}>
            {value_cells(rows, palette)}
          </Bar>
        )}
        <Scatter dataKey="value" {...animation(animate)}>
          {value_cells(rows, palette)}
          <ValueLabels density={density} palette={palette} dataKey="value" position="top" />
        </Scatter>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/**
 * Multi-series columns or bars: side by side (grouped), stacked, or stacked
 * to 100 percent (each row rescaled to its own total). A third field
 * (series_meta) textures each series inside its split color. The legend is
 * drawn by SeriesLegend where the appearance places it - under the chart
 * whenever the card is too narrow to carry one beside it.
 */
function SeriesColumns({ rows, series, seriesMeta, mode, horizontal, palette, labels, animate, density }) {
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
  const y_width = y_axis_width(row_labels, density.y_max);
  const axis_height = x_axis_height(row_labels, density.x_chars);
  const height = horizontal
    ? Math.max(density.height, rows.length * bar_row_height(row_labels, density.y_max, stacked ? density.row_base + 2 : Math.max(density.row_base - 8, series.length * (density.font + 7))))
    : density.height + axis_height - 30;
  const split_colors = display.splits.map((split, index) => palette.color_for(split, index));
  const segment_font = Math.max(8, density.value_font - 1);

  const chart = (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={horizontal && density.show_values ? horizontal_margin : common_margin}>
        <PatternDefs uid={uid} colors={split_colors} patternCount={display.patterns.length} />
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={tick_style(palette, density)} allowDecimals={mode === "stacked_100"} unit={mode === "stacked_100" ? "%" : undefined} stroke={palette.grid} />
            <YAxis type="category" dataKey="label" width={y_width} interval={0} stroke={palette.grid} tick={wrapped_tick(palette, chars_for_width(y_width), "end", density.font)} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" interval={0} height={axis_height} stroke={palette.grid} tick={wrapped_tick(palette, density.x_chars, "middle", density.font)} />
            <YAxis tick={tick_style(palette, density)} allowDecimals={mode === "stacked_100"} unit={mode === "stacked_100" ? "%" : undefined} stroke={palette.grid} width={density.font * 3.5} />
          </>
        )}
        <Tooltip contentStyle={palette.tooltip} formatter={(value, name) => [value, display.items.find((item) => item.key === name)?.label || name]} />
        {display.items.map((item, index) => (
          <Bar key={item.key} dataKey={item.key} stackId={stacked ? "stack" : undefined} fill={pattern_fill(uid, item.split_index, item.pattern_index, item.color)} {...animation(animate)} maxBarSize={horizontal ? density.bar : density.column_bar}>
            {density.show_values &&
              (stacked ? (
                <LabelList dataKey={item.key} position="center" formatter={(value) => (value ? (mode === "stacked_100" ? `${value}%` : value) : "")} style={{ fontSize: segment_font, fontWeight: 600, fill: "#FFFFFF" }} />
              ) : (
                <LabelList dataKey={item.key} position={horizontal ? "right" : "top"} formatter={(value) => (value ? value : "")} style={value_style(palette, density, segment_font)} />
              ))}
            {mode === "stacked" && density.show_values && index === display.items.length - 1 && (
              <LabelList dataKey={(entry) => series.reduce((sum, key) => sum + (entry[key] || 0), 0)} position={horizontal ? "right" : "top"} formatter={show_value} style={value_style(palette, density)} />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <LegendFrame position={palette.legend_position} density={density} legend={<SplitLegend display={display} totals={totals} palette={palette} splitTitle={labels && labels.split} patternTitle={labels && labels.pattern} />}>
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

export default function CategoryCharts({ chartType, rows, series, seriesMeta, onItemClick, palette, legendLabels, animate, density }) {
  const colors = palette || build_palette(null);
  const size = density || chart_density();
  const shared = { rows, palette: colors, animate, density: size };
  if (chartType === "bar") return <HorizontalBars {...shared} onItemClick={onItemClick} />;
  if (chartType === "column") return <VerticalColumns {...shared} onItemClick={onItemClick} />;
  if (chartType === "lollipop") return <LollipopOrDots {...shared} with_stick />;
  if (chartType === "dot_plot") return <LollipopOrDots {...shared} with_stick={false} />;
  const multi = MULTI_SERIES_TYPES[chartType];
  if (multi) return <SeriesColumns {...shared} series={series} seriesMeta={seriesMeta} mode={multi.mode} horizontal={multi.horizontal} labels={legendLabels} />;
  return <VerticalColumns {...shared} onItemClick={onItemClick} />;
}
