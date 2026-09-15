import React from "react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip } from "recharts";
import { CHART_HEIGHT } from "./chartTheme.js";
import { build_palette } from "../appearance.js";

/**
 * Scatter and bubble renderers: each submission becomes one point at its
 * two numeric answers; the bubble variation sizes each point by a third
 * numeric field. Points draw in the widget's number color.
 */
export default function PointCharts({ chartType, points, xLabel, yLabel, palette }) {
  const colors = palette || build_palette(null);
  const has_size = chartType === "bubble";
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <ScatterChart margin={{ top: 12, right: 16, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis type="number" dataKey="x" name={xLabel} tick={colors.tick} stroke={colors.grid} />
        <YAxis type="number" dataKey="y" name={yLabel} tick={colors.tick} stroke={colors.grid} />
        {has_size && <ZAxis type="number" dataKey="size" range={[40, 400]} />}
        <Tooltip contentStyle={colors.tooltip} cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={points} fill={colors.accent} fillOpacity={0.7} isAnimationActive animationDuration={700} animationEasing="ease-out" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
