import React, { useId } from "react";
import { ResponsiveContainer, BarChart, Bar, Cell, ComposedChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from "recharts";
import { build_palette } from "../appearance.js";
import { wrapped_tick, y_axis_width, y_label_room, value_axis_width, number_room, bar_row_height, widest_word, text_width } from "./chartLabels.jsx";
import { category_axis, value_step, with_value_labels, fit_value_font, MIN_VALUE_FONT, VALUE_LABEL_KEY } from "./labelDensity.jsx";
import { chart_density, tick_style, value_style } from "./density.js";
import { PatternDefs, pattern_fill, series_display } from "./patterns.jsx";
import { SplitLegend, LegendFrame } from "./SeriesLegend.jsx";

/**
 * Every category-comparison renderer: bar (horizontal), column (vertical),
 * lollipop, dot plot, grouped columns, stacked columns and the 100 percent
 * stacked variation.
 *
 * Many categories never stack on each other: every category gets at
 * least its minimum room (and a long name enough room to wrap into a few
 * lines), and when that is more than the card can show the chart widens
 * and scrolls SIDEWAYS inside the card. A horizontal bar chart of many rows
 * grows row by row and scrolls VERTICALLY inside the card past a cap.
 *
 * Only the fit-to-screen mode compresses everything into the card, and
 * that is where fifty categories have to share one width. The axis then
 * lies its labels over at 45 degrees and, past what even that can carry,
 * draws every n-th one (see labelDensity); the numbers on the marks are
 * thinned against their own width the same way. Nothing is invented and
 * nothing is silently dropped - every mark is drawn, and the tooltip names
 * and numbers whichever one is under the pointer.
 *
 * Nothing is ever cut: the numeric axis reserves room for the largest
 * number it will print, a value written beside a bar reserves room for the
 * longest of them, the top margin fits a value written above a column, and
 * a category name wraps over as many lines as it needs - across as many
 * characters per line as its own share of the width allows. Every one of
 * those measurements starts from the card's measured width (see
 * density.js), so a small widget draws a small, complete chart instead of
 * stretching its card. Colors come from the widget's palette - one per
 * category value or per series - and a third field (series_meta) draws as
 * a texture inside each series color. Marks grow in and glide to values.
 */

// How long marks take to grow in. Deliberately short: the charting
// library draws no value labels at all while a chart is animating, so this
// is also how long a chart goes without its numbers after every change.
const ANIMATION_MS = 260;

const animation = (animate) => ({ isAnimationActive: animate !== false, animationDuration: ANIMATION_MS, animationEasing: "ease-out" });

const show_value = (value) => (value ? value : "");
const clicked_row = (entry) => (entry && entry.payload ? entry.payload : entry);
const labels_of = (rows) => rows.map((row) => row.label);
const values_of = (rows) => rows.map((row) => row.value || 0);
const value_cells = (rows, palette) => rows.map((row, index) => <Cell key={`${row.label}-${index}`} fill={palette.color_for(row.label, index)} />);
// Room above a column for the value written on top of it, and beside a bar
// for the value written after it.
const top_room = (density) => (density.show_values ? density.value_font + 12 : 10);
const right_room = (density, values) => (density.show_values ? number_room(values, density.value_font) + 10 : 12);

/**
 * How wide a category axis may grow: normally under half the card, but
 * never so narrow that the longest single word of a label has to be
 * broken - a name like "Nyarugenge" is shown whole or not at all.
 */
function category_axis_cap(labels, density) {
  const widest = labels.reduce((best, label) => Math.max(best, widest_word(label, density.font)), 0);
  const comfortable = Math.min(density.y_max, density.width * 0.45);
  return Math.min(Math.max(comfortable, Math.ceil(widest) + 18), Math.max(80, density.width * 0.62));
}

/**
 * How the categories of an X axis are laid out: the room each gets for its
 * label and the width the chart must have to give it. Each category gets
 * at least the card size's minimum, and a long label enough to wrap into
 * about six lines; when the categories then need more width than the card
 * offers, the chart widens (and scrolls sideways inside the card). In fit
 * mode the card's width is simply shared out.
 */
function category_frame(labels, count, density, fixed_px, fit) {
  const longest = labels.reduce((best, label) => Math.max(best, text_width(label, density.font)), 0);
  const wanted = Math.max(density.min_col_px, Math.min(260, Math.ceil(longest / 6) + 16));
  const available = Math.max(80, density.width - fixed_px);
  const per = fit ? available / Math.max(1, count) : Math.max(wanted, available / Math.max(1, count));
  const width = fit ? density.width : Math.max(density.width, Math.ceil(per * count + fixed_px));
  return { room: Math.max(28, per - 6), width };
}

/**
 * A chart that may be wider than its card scrolls sideways inside it; a
 * taller one scrolls down. Fitting to the screen is about WIDTH - a chart
 * of eighty rows is still eighty rows tall, and it is scrolled to rather
 * than cut off by the bottom of the card.
 */
function ScrollFrame({ width, height, fit, density, children }) {
  return (
    <div style={{ width: "100%", maxWidth: "100%", overflowX: fit || !width ? "hidden" : "auto", overflowY: height ? "auto" : "hidden", maxHeight: height ? density.max_height : undefined }}>
      <div style={{ minWidth: fit || !width ? undefined : width }}>{children}</div>
    </div>
  );
}

/** A value written on a mark, left out entirely when the card is too narrow to read one. */
function ValueLabels({ density, palette, dataKey, position, formatter, size }) {
  if (!density.show_values) return null;
  return <LabelList dataKey={dataKey} position={position} formatter={formatter || show_value} style={value_style(palette, density, size)} />;
}

function HorizontalBars({ rows, onItemClick, palette, animate, density, fitMode }) {
  const labels = labels_of(rows);
  const cap = category_axis_cap(labels, density);
  const width = y_axis_width(labels, cap, density.font);
  const room = y_label_room(width);
  const height = Math.max(density.height, rows.length * bar_row_height(labels, room, density.row_base, density.font));
  const margin = { top: 10, right: right_room(density, values_of(rows)), left: 0, bottom: 5 };
  return (
    <ScrollFrame height={height} fit={fitMode} density={density}>
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={margin}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} horizontal={false} />
        <XAxis type="number" tick={tick_style(palette, density)} allowDecimals={false} stroke={palette.grid} height={density.font * 2} />
        <YAxis type="category" dataKey="label" width={width} interval={0} stroke={palette.grid} tick={wrapped_tick(palette, room, "end", density.font)} />
        <Tooltip contentStyle={palette.tooltip} itemStyle={palette.tooltip_text} labelStyle={palette.tooltip_text} />
        <Bar dataKey="value" {...animation(animate)} maxBarSize={density.bar} cursor={onItemClick ? "pointer" : undefined} onClick={onItemClick ? (entry) => onItemClick(clicked_row(entry)) : undefined}>
          {value_cells(rows, palette)}
          <ValueLabels density={density} palette={palette} dataKey="value" position="right" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </ScrollFrame>
  );
}

/** Columns and the lollipop / dot variations - one mark per category. */
function VerticalMarks({ rows, onItemClick, palette, animate, density, shape, fitMode }) {
  const labels = labels_of(rows);
  const values = values_of(rows);
  const y_width = value_axis_width(values, density.font);
  const margin = { top: top_room(density), right: 14, left: 0, bottom: 5 };
  const frame = category_frame(labels, rows.length, density, y_width + margin.right + 8, fitMode);
  const axis = category_axis(labels, frame.room, density.font, palette, y_width);
  const height = density.height + axis.height - 30;
  // A number is not as wide as a name, so the two are handled separately.
  // The figures shrink to the column first; only when even the smallest
  // will not fit are they thinned, and then evenly.
  const fitted = density.show_values ? fit_value_font(values, frame.room, density.value_font, MIN_VALUE_FONT) : 0;
  const number_font = fitted || MIN_VALUE_FONT;
  const number_step = !density.show_values || fitted ? 1 : value_step(values, frame.room, MIN_VALUE_FONT);
  const data = with_value_labels(rows, "value", number_step);
  const number_key = number_step > 1 ? VALUE_LABEL_KEY : "value";
  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
      <XAxis dataKey="label" interval={axis.interval} height={axis.height} stroke={palette.grid} tick={axis.tick} />
      <YAxis tick={tick_style(palette, density)} allowDecimals={false} stroke={palette.grid} width={y_width} />
      <Tooltip contentStyle={palette.tooltip} itemStyle={palette.tooltip_text} labelStyle={palette.tooltip_text} />
    </>
  );
  if (shape === "column") {
    return (
      <ScrollFrame width={frame.width} fit={fitMode} density={density}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={margin}>
            {axes}
            <Bar dataKey="value" {...animation(animate)} maxBarSize={density.column_bar} cursor={onItemClick ? "pointer" : undefined} onClick={onItemClick ? (entry) => onItemClick(clicked_row(entry)) : undefined}>
              {value_cells(rows, palette)}
              <ValueLabels density={density} palette={palette} dataKey={number_key} position="top" size={number_font} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ScrollFrame>
    );
  }
  return (
    <ScrollFrame width={frame.width} fit={fitMode} density={density}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={margin}>
          {axes}
          {shape === "lollipop" && (
            <Bar dataKey="value" barSize={3} {...animation(animate)}>
              {value_cells(rows, palette)}
            </Bar>
          )}
          <Scatter dataKey="value" {...animation(animate)}>
            {value_cells(rows, palette)}
            <ValueLabels density={density} palette={palette} dataKey={number_key} position="top" size={number_font} />
          </Scatter>
        </ComposedChart>
      </ResponsiveContainer>
    </ScrollFrame>
  );
}

/**
 * Multi-series columns or bars: side by side (grouped), stacked, or stacked
 * to 100 percent (each row rescaled to its own total). A third field
 * (series_meta) textures each series inside its split color. The legend is
 * drawn by SeriesLegend where the appearance places it - under the chart
 * whenever the card is too narrow to carry one beside it.
 */
function SeriesColumns({ rows, series, seriesMeta, mode, horizontal, palette, labels, animate, density, fitMode, onItemClick, onLegendClick }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const display = series_display(series, seriesMeta, palette);
  const row_total = (row) => series.reduce((sum, key) => sum + (row[key] || 0), 0);
  const data =
    mode === "stacked_100"
      ? rows.map((row) => {
          const total = row_total(row) || 1;
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
  // The biggest number any axis or label will have to print.
  const peak = mode === "stacked_100" ? [100] : rows.map((row) => (stacked ? row_total(row) : Math.max(0, ...series.map((key) => row[key] || 0))));
  const base_segment_font = Math.max(8, density.value_font - 1);
  const y_width = horizontal ? y_axis_width(row_labels, category_axis_cap(row_labels, density), density.font) : value_axis_width(peak, density.font);
  const y_room = y_label_room(y_width);
  const margin = horizontal
    ? { top: 10, right: right_room(density, peak), left: 0, bottom: 5 }
    : { top: top_room(density), right: 14, left: 0, bottom: 5 };
  const frame = horizontal ? { room: 0, width: 0 } : category_frame(row_labels, rows.length, density, y_width + margin.right + 8, fitMode);
  const axis = horizontal ? null : category_axis(row_labels, frame.room, density.font, palette, y_width);
  // A grouped column is a fraction of its category's room and a stacked
  // segment a fraction of its height, so the figures are written as small
  // as they need to be to fit the slot one series actually gets. Only when
  // even the smallest readable size will not fit are they left to the
  // tooltip. A horizontal bar writes its numbers in the margin beside it,
  // where the room is the chart's, not one column's.
  const slot = horizontal ? Infinity : frame.room / Math.max(1, stacked ? 1 : series.length);
  const segment_font = fit_value_font(peak, slot, base_segment_font, MIN_VALUE_FONT);
  const show_numbers = density.show_values && segment_font > 0;
  const height = horizontal
    ? Math.max(density.height, rows.length * bar_row_height(row_labels, y_room, stacked ? density.row_base + 2 : Math.max(density.row_base - 8, series.length * (density.font + 7)), density.font))
    : density.height + axis.height - 30;
  const split_colors = display.splits.map((split, index) => palette.color_for(split, index));

  const chart = (
    <ScrollFrame width={horizontal ? 0 : frame.width} height={horizontal ? height : 0} fit={fitMode} density={density}>
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={margin}>
        <PatternDefs uid={uid} colors={split_colors} patternCount={display.patterns.length} />
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={tick_style(palette, density)} allowDecimals={mode === "stacked_100"} unit={mode === "stacked_100" ? "%" : undefined} stroke={palette.grid} height={density.font * 2} />
            <YAxis type="category" dataKey="label" width={y_width} interval={0} stroke={palette.grid} tick={wrapped_tick(palette, y_room, "end", density.font)} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" interval={axis.interval} height={axis.height} stroke={palette.grid} tick={axis.tick} />
            <YAxis tick={tick_style(palette, density)} allowDecimals={mode === "stacked_100"} unit={mode === "stacked_100" ? "%" : undefined} stroke={palette.grid} width={y_width} />
          </>
        )}
        <Tooltip contentStyle={palette.tooltip} itemStyle={palette.tooltip_text} labelStyle={palette.tooltip_text} formatter={(value, name) => [value, display.items.find((item) => item.key === name)?.label || name]} />
        {display.items.map((item, index) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            stackId={stacked ? "stack" : undefined}
            fill={pattern_fill(uid, item.split_index, item.pattern_index, item.color)}
            {...animation(animate)}
            maxBarSize={horizontal ? density.bar : density.column_bar}
            cursor={onItemClick ? "pointer" : undefined}
            onClick={onItemClick ? (entry) => onItemClick({ label: clicked_row(entry).label, series: item.split || item.key, pattern: item.pattern }) : undefined}
          >
            {show_numbers &&
              (stacked ? (
                <LabelList dataKey={item.key} position="center" formatter={(value) => (value ? (mode === "stacked_100" ? `${value}%` : value) : "")} style={{ fontSize: segment_font, fontWeight: 600, fill: palette.on_mark(item.color) }} />
              ) : (
                <LabelList dataKey={item.key} position={horizontal ? "right" : "top"} formatter={show_value} style={value_style(palette, density, segment_font)} />
              ))}
            {mode === "stacked" && show_numbers && index === display.items.length - 1 && (
              <LabelList dataKey={(entry) => row_total(entry)} position={horizontal ? "right" : "top"} formatter={show_value} style={value_style(palette, density)} />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
    </ScrollFrame>
  );

  return (
    <LegendFrame position={palette.legend_position} density={density} legend={<SplitLegend display={display} totals={totals} palette={palette} splitTitle={labels && labels.split} patternTitle={labels && labels.pattern} onItemClick={onLegendClick} />}>
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

export default function CategoryCharts({ chartType, rows, series, seriesMeta, onItemClick, onLegendClick, palette, legendLabels, animate, density, fitMode }) {
  const colors = palette || build_palette(null);
  const size = density || chart_density();
  const shared = { rows, palette: colors, animate, density: size, fitMode };
  if (chartType === "bar") return <HorizontalBars {...shared} onItemClick={onItemClick} />;
  if (chartType === "lollipop") return <VerticalMarks {...shared} shape="lollipop" onItemClick={onItemClick} />;
  if (chartType === "dot_plot") return <VerticalMarks {...shared} shape="dots" onItemClick={onItemClick} />;
  const multi = MULTI_SERIES_TYPES[chartType];
  if (multi) return <SeriesColumns {...shared} series={series} seriesMeta={seriesMeta} mode={multi.mode} horizontal={multi.horizontal} labels={legendLabels} onItemClick={onItemClick} onLegendClick={onLegendClick} />;
  return <VerticalMarks {...shared} shape="column" onItemClick={onItemClick} />;
}
