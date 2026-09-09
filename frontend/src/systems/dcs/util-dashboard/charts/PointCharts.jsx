import React from "react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip } from "recharts";
import { PRIMARY, TOOLTIP_STYLE, AXIS_TICK, GRID_STROKE, CHART_HEIGHT } from "./chartTheme.js";

/**
 * Scatter and bubble renderers: each submission becomes one point at its
 * two numeric answers; the bubble variation sizes each point by a third
 * numeric field.
 */
export default function PointCharts({ chartType, points, xLabel, yLabel }) {
  const has_size = chartType === "bubble";
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <ScatterChart margin={{ top: 12, right: 16, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis type="number" dataKey="x" name={xLabel} tick={AXIS_TICK} />
        <YAxis type="number" dataKey="y" name={yLabel} tick={AXIS_TICK} />
        {has_size && <ZAxis type="number" dataKey="size" range={[40, 400]} />}
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={points} fill={PRIMARY} fillOpacity={0.7} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
