import React from "react";
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from "recharts";
import { build_palette } from "../appearance.js";
import { wrapped_tick, x_axis_height, value_axis_width } from "./chartLabels.jsx";
import { chart_density, tick_style } from "./density.js";
import { LegendRow, LegendFrame } from "./SeriesLegend.jsx";

const animation = (animate) => ({ isAnimationActive: animate !== false, animationDuration: 700, animationEasing: "ease-out" });

const show_value = (value) => (value ? value : "");

/**
 * Time-series renderers: line (single or multi series) and area. Every
 * measurement comes from the card's own width (see density.js), so a small
 * card draws a short chart with small labels instead of pushing its card
 * wider. A range with more points than the card can show scrolls sideways
 * INSIDE the card - except in fit-to-screen mode, where it compresses and
 * thins its labels. Labels wrap rather than being cut. A single series
 * draws in the widget's number color, split series in their own value
 * colors with the shared legend placed by the appearance.
 */
export default function TimeCharts({ chartType, rows, series, fitMode, palette, animate, density, onItemClick, onLegendClick }) {
  const colors = palette || build_palette(null);
  const size = density || chart_density();
  const tick_interval = fitMode ? "preserveStartEnd" : 0;
  const accent = colors.accent;
  const has_series = series && series.length > 0;
  const value_font = Math.max(8, size.value_font);
  // Room for the biggest number the axis will print, for a value written
  // above a point, and for each label to spell itself out under its point.
  const peak = has_series ? rows.map((row) => Math.max(0, ...series.map((key) => row[key] || 0))) : rows.map((row) => row.value || 0);
  const y_width = value_axis_width(peak, size.font);
  const margin = { top: size.show_values ? value_font + 12 : 12, right: 14, left: 0, bottom: 5 };
  const inner_width = Math.max(rows.length * size.point_px, size.width);
  const x_room = Math.max(28, Math.max(80, inner_width - y_width - margin.right - 8) / Math.max(1, rows.length) - 6);
  const axis_height = x_axis_height(rows.map((row) => row.label), x_room, size.font);
  const chart_height = size.height + axis_height - 30;
  // Recharts reports the hovered category as activeLabel: that is the bucket clicked.
  const on_chart_click = onItemClick ? (state) => state && state.activeLabel !== undefined && onItemClick(String(state.activeLabel)) : undefined;
  const active_dot = onItemClick ? { r: 6, cursor: "pointer" } : undefined;
  const chart =
    chartType === "area" ? (
      <AreaChart data={rows} margin={margin} onClick={on_chart_click} style={onItemClick ? { cursor: "pointer" } : undefined}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="label" interval={tick_interval} height={axis_height} stroke={colors.grid} tick={wrapped_tick(colors, x_room, "middle", size.font)} />
        <YAxis tick={tick_style(colors, size)} allowDecimals={false} stroke={colors.grid} width={y_width} />
        <Tooltip contentStyle={colors.tooltip} itemStyle={colors.tooltip_text} labelStyle={colors.tooltip_text} />
        <Area type="monotone" dataKey="value" stroke={accent} fill={accent} fillOpacity={0.18} strokeWidth={2.5} activeDot={active_dot} {...animation(animate)}>
          {size.show_values && <LabelList dataKey="value" position="top" formatter={show_value} style={{ fontSize: value_font, fontWeight: 600, fill: accent }} />}
        </Area>
      </AreaChart>
    ) : (
      <LineChart data={rows} margin={margin} onClick={on_chart_click} style={onItemClick ? { cursor: "pointer" } : undefined}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey="label" interval={tick_interval} height={axis_height} stroke={colors.grid} tick={wrapped_tick(colors, x_room, "middle", size.font)} />
        <YAxis tick={tick_style(colors, size)} allowDecimals={false} stroke={colors.grid} width={y_width} />
        <Tooltip contentStyle={colors.tooltip} itemStyle={colors.tooltip_text} labelStyle={colors.tooltip_text} />
        {has_series ? (
          series.map((key, index) => {
            const color = colors.color_for(key, index);
            return (
              <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2.5} dot={{ r: 2.5, fill: color }} activeDot={active_dot} {...animation(animate)}>
                {size.show_values && <LabelList dataKey={key} position="top" formatter={show_value} style={{ fontSize: Math.max(8, value_font - 1), fontWeight: 600, fill: color }} />}
              </Line>
            );
          })
        ) : (
          <Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2.5} dot={{ r: 2.5, fill: accent }} activeDot={active_dot} {...animation(animate)}>
            {size.show_values && <LabelList dataKey="value" position="top" formatter={show_value} style={{ fontSize: value_font, fontWeight: 600, fill: accent }} />}
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
        <div style={{ minWidth: fitMode ? undefined : rows.length * size.point_px, height: chart_height }}>
          <ResponsiveContainer width="100%" height="100%">
            {chart}
          </ResponsiveContainer>
        </div>
      </div>
    </LegendFrame>
  );
}
