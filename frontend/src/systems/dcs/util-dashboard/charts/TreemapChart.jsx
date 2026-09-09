import React from "react";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { series_color, TOOLTIP_STYLE, CHART_HEIGHT } from "./chartTheme.js";

/**
 * Custom cell so every rectangle carries a readable label whenever it is
 * large enough, tinted by its root branch so siblings read as one family.
 */
function TreemapCell(props) {
  const { x, y, width, height, name, value, root, index } = props;
  const color_index = root && typeof root.index === "number" ? root.index : index || 0;
  const show_label = width > 56 && height > 26;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} style={{ fill: series_color(color_index), stroke: "#FFFFFF", strokeWidth: 2 }} />
      {show_label && (
        <text x={x + 6} y={y + 16} fill="#FFFFFF" fontSize={11} fontWeight={600}>
          {String(name).slice(0, Math.max(4, Math.floor(width / 7)))}
        </text>
      )}
      {show_label && height > 40 && (
        <text x={x + 6} y={y + 31} fill="rgba(255,255,255,0.85)" fontSize={11}>
          {value}
        </text>
      )}
    </g>
  );
}

export default function TreemapChart({ nodes }) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <Treemap data={nodes} dataKey="value" nameKey="name" isAnimationActive={false} content={<TreemapCell />}>
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [value, name]} />
      </Treemap>
    </ResponsiveContainer>
  );
}
