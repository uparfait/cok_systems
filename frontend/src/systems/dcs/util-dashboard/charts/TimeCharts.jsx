import React from "react";
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from "recharts";
import { build_palette } from "../appearance.js";
import { value_axis_width, number_room } from "./chartLabels.jsx";
import { category_axis, value_step, stagger_values, fit_value_font, MIN_VALUE_FONT } from "./labelDensity.jsx";
import { chart_density, tick_style } from "./density.js";
import { LegendRow, LegendFrame } from "./SeriesLegend.jsx";

// The marks do not animate, and that is deliberate: the charting library
// hides every value label for as long as a series is animating, and a card
// that is off screen or mid-layout when it mounts can stay "animating"
// indefinitely - which is how charts ended up with no numbers on them
// until something forced a redraw. A chart that can always be read beats a
// chart that grows in. (animate is still accepted so callers need not change.)
const animation = () => ({ isAnimationActive: false });

const value_text = (colors) => (value) => (value ? colors.number_text(value) : "");

/**
 * Time-series renderers: line (single or multi series) and area. Every
 * measurement comes from the card's own width (see density.js), so a small
 * card draws a short chart with small labels instead of pushing its card
 * wider. A range with more points than the card can show scrolls sideways
 * INSIDE the card.
 *
 * Fit-to-screen mode is the one that cannot scroll, so a hundred days have
 * to share one width. The axis then lies its dates over at 45 degrees and,
 * where even that will not fit, labels every n-th point (see
 * labelDensity) - evenly, so the axis still reads as a time line. The
 * numbers written on the points zigzag above and below the line so they
 * all fit, and thin only past what that holds.
 * The line itself never loses a point, and the tooltip carries the date
 * and value of whichever one is under the pointer. A single series draws
 * in the widget's number color, split series in their own value colors
 * with the shared legend placed by the appearance.
 */
export default function TimeCharts({ chartType, rows, series, fitMode, palette, animate, density, onItemClick, onLegendClick }) {
  const colors = palette || build_palette(null);
  const size = density || chart_density();
  const accent = colors.accent;
  const has_series = series && series.length > 0;
  const value_font = Math.max(8, size.value_font);
  // Room for the biggest number the axis will print, for a value written
  // above a point, and for each label to spell itself out under its point.
  const peak = has_series ? rows.map((row) => Math.max(0, ...series.map((key) => row[key] || 0))) : rows.map((row) => row.value || 0);
  const y_width = value_axis_width(peak, size.font);
  const margin = { top: size.show_values ? value_font + 12 : 12, right: 14, left: 0, bottom: 5 };
  // Fitting to the screen means the chart may not grow past the card, so
  // the points share the card's width instead of claiming their own.
  // A point is never closer to the next than the number it carries is
  // wide: the line widens and scrolls inside the card rather than give up
  // on writing its values.
  const point_px = size.show_values ? Math.max(size.point_px, number_room(peak, value_font, colors.number_text) + 10) : size.point_px;
  const inner_width = fitMode ? size.width : Math.max(rows.length * point_px, size.width);
  const x_room = Math.max(6, Math.max(80, inner_width - y_width - margin.right - 8) / Math.max(1, rows.length) - 6);
  const labels = rows.map((row) => row.label);
  const axis = category_axis(labels, x_room, size.font, colors, y_width);
  const chart_height = size.height + axis.height - 30;
  // Numbers along a line zigzag ABOVE and BELOW it rather than crowding
  // one side, which doubles the room each one has (see stagger_values);
  // only past what even that holds are they thinned. Several lines sharing
  // the same vertical room have nowhere to zigzag into, so a split chart
  // writes its numbers only where they already fit.
  // Written as small as they need to be to fit between the points, before
  // any of them is moved below the line or dropped.
  const number_font = size.show_values ? fit_value_font(peak, x_room * 2, value_font, MIN_VALUE_FONT, colors.number_text) || MIN_VALUE_FONT : value_font;
  const numbers = size.show_values && !has_series ? stagger_values(rows, "value", x_room, peak, number_font, colors.number_text) : { rows, above: "value", below: null };
  const data = numbers.rows;
  const series_numbers = size.show_values && has_series && value_step(peak, x_room, number_font, colors.number_text) === 1;
  // Recharts reports the hovered category as activeLabel: that is the bucket clicked.
  const show_value = value_text(colors);
  const on_chart_click = onItemClick ? (state) => state && state.activeLabel !== undefined && onItemClick(String(state.activeLabel)) : undefined;
  const active_dot = onItemClick ? { r: 6, cursor: "pointer" } : undefined;
  const chart =
    chartType === "area" ? (
      <AreaChart data={data} margin={margin} onClick={on_chart_click} style={onItemClick ? { cursor: "pointer" } : undefined}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="label" interval={axis.interval} height={axis.height} stroke={colors.grid} tick={axis.tick} />
        <YAxis tick={tick_style(colors, size)} allowDecimals={false} stroke={colors.grid} width={y_width} />
        <Tooltip contentStyle={colors.tooltip} itemStyle={colors.tooltip_text} labelStyle={colors.tooltip_text} />
        <Area type="monotone" dataKey="value" stroke={accent} fill={accent} fillOpacity={0.18} strokeWidth={2.5} activeDot={active_dot} {...animation(animate)}>
          {size.show_values && <LabelList dataKey={numbers.above} position="top" formatter={show_value} style={{ fontSize: number_font, fontWeight: 600, fill: accent }} />}
          {size.show_values && numbers.below && <LabelList dataKey={numbers.below} position="bottom" formatter={show_value} style={{ fontSize: number_font, fontWeight: 600, fill: accent }} />}
        </Area>
      </AreaChart>
    ) : (
      <LineChart data={data} margin={margin} onClick={on_chart_click} style={onItemClick ? { cursor: "pointer" } : undefined}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="label" interval={axis.interval} height={axis.height} stroke={colors.grid} tick={axis.tick} />
        <YAxis tick={tick_style(colors, size)} allowDecimals={false} stroke={colors.grid} width={y_width} />
        <Tooltip contentStyle={colors.tooltip} itemStyle={colors.tooltip_text} labelStyle={colors.tooltip_text} />
        {has_series ? (
          series.map((key, index) => {
            const color = colors.color_for(key, index);
            return (
              <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2.5} dot={{ r: 2.5, fill: color }} activeDot={active_dot} {...animation(animate)}>
                {series_numbers && <LabelList dataKey={key} position="top" formatter={show_value} style={{ fontSize: Math.max(MIN_VALUE_FONT, number_font - 1), fontWeight: 600, fill: color }} />}
              </Line>
            );
          })
        ) : (
          <Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2.5} dot={{ r: 2.5, fill: accent }} activeDot={active_dot} {...animation(animate)}>
            {size.show_values && <LabelList dataKey={numbers.above} position="top" formatter={show_value} style={{ fontSize: number_font, fontWeight: 600, fill: accent }} />}
            {size.show_values && numbers.below && <LabelList dataKey={numbers.below} position="bottom" formatter={show_value} style={{ fontSize: number_font, fontWeight: 600, fill: accent }} />}
          </Line>
        )}
      </LineChart>
    );

  const legend = has_series ? (
    <LegendRow items={series.map((key, index) => ({ label: key, color: colors.color_for(key, index), value: rows.reduce((sum, row) => sum + (row[key] || 0), 0) }))} palette={colors} onItemClick={onLegendClick} />
  ) : null;

  return (
    <LegendFrame position={colors.legend_position} density={size} legend={legend}>
      <div style={{ width: "100%", maxWidth: "100%", overflowX: fitMode ? "hidden" : "auto" }}>
        {/* A block div already fills the card; min-width only raises it,
            so the chart only ever scrolls when it has more points than the
            card can show at a readable spacing. */}
        <div style={{ minWidth: fitMode ? undefined : rows.length * point_px, height: chart_height }}>
          <ResponsiveContainer width="100%" height="100%">
            {chart}
          </ResponsiveContainer>
        </div>
      </div>
    </LegendFrame>
  );
}
