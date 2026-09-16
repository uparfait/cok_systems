import React from "react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip } from "recharts";
import { build_palette } from "../appearance.js";
import { chart_density, tick_style } from "./density.js";

/**
 * Scatter and bubble renderers: each submission becomes one point at its
 * two numeric answers; the bubble variation sizes each point by a third
 * numeric field. Height, axis fonts and bubble sizes all follow the card's
 * own width (see density.js). Points draw in the widget's number color.
 */
export default function PointCharts({ chartType, points, xLabel, yLabel, palette, animate, density, onItemClick }) {
  const colors = palette || build_palette(null);
  const size = density || chart_density();
  const has_size = chartType === "bubble";
  const bubble_max = Math.max(120, Math.round(size.height * 1.5));
  return (
    <ResponsiveContainer width="100%" height={size.height}>
      <ScatterChart margin={{ top: 12, right: 12, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis type="number" dataKey="x" name={xLabel} tick={tick_style(colors, size)} stroke={colors.grid} height={size.font * 2.5} />
        <YAxis type="number" dataKey="y" name={yLabel} tick={tick_style(colors, size)} stroke={colors.grid} width={size.font * 3} />
        {has_size && <ZAxis type="number" dataKey="size" range={[30, bubble_max]} />}
        <Tooltip contentStyle={colors.tooltip} itemStyle={colors.tooltip_text} labelStyle={colors.tooltip_text} cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={points} fill={colors.accent} fillOpacity={0.7} isAnimationActive={animate !== false} animationDuration={700} animationEasing="ease-out" cursor={onItemClick ? "pointer" : undefined} onClick={onItemClick ? (entry) => onItemClick(entry && entry.payload ? entry.payload : entry) : undefined} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
