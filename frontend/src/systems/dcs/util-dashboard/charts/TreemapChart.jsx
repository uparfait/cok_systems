import React from "react";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { CHART_HEIGHT } from "./chartTheme.js";
import { build_palette } from "../appearance.js";

/**
 * Custom cell so every rectangle carries a readable label whenever it is
 * large enough, tinted by its root branch so siblings read as one family -
 * the branch's own value color when one was configured.
 */
function TreemapCell(props) {
  const { x, y, width, height, name, value, root, index, palette } = props;
  const color_index = root && typeof root.index === "number" ? root.index : index || 0;
  const color_label = root && root.name !== undefined ? root.name : name;
  const show_label = width > 56 && height > 26;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} style={{ fill: palette.color_for(color_label, color_index), stroke: palette.background, strokeWidth: 2 }} />
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

export default function TreemapChart({ nodes, palette }) {
  const colors = palette || build_palette(null);
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <Treemap data={nodes} dataKey="value" nameKey="name" isAnimationActive animationDuration={700} animationEasing="ease-out" content={<TreemapCell palette={colors} />}>
        <Tooltip contentStyle={colors.tooltip} formatter={(value, name) => [value, name]} />
      </Treemap>
    </ResponsiveContainer>
  );
}
