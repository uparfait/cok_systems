import React from "react";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { build_palette } from "../appearance.js";
import { chart_density } from "./density.js";
import { fit_text } from "./chartLabels.jsx";

/**
 * Custom cell so every rectangle carries a readable label whenever it is
 * large enough for one, tinted by its root branch so siblings read as one
 * family - the branch's own value color when one was configured. A label
 * is drawn only when its rectangle can hold it, so nothing ever spills
 * over a neighbouring tile.
 */
function TreemapCell(props) {
  const { x, y, width, height, name, value, root, index, palette, fontSize } = props;
  const color_index = root && typeof root.index === "number" ? root.index : index || 0;
  const color_label = root && root.name !== undefined ? root.name : name;
  // Measured, so a name is either shown whole or trimmed to what truly
  // fits the tile - never drawn over its neighbour.
  const label = fit_text(name, width - 10, fontSize);
  const show_label = height > fontSize * 2.2 && label !== "";
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} style={{ fill: palette.color_for(color_label, color_index), stroke: palette.background, strokeWidth: 2 }} />
      {show_label && (
        <text x={x + 5} y={y + fontSize + 3} fill="#FFFFFF" fontSize={fontSize} fontWeight={600}>
          {label}
        </text>
      )}
      {show_label && height > fontSize * 3.6 && (
        <text x={x + 5} y={y + fontSize * 2.4 + 3} fill="rgba(255,255,255,0.85)" fontSize={fontSize}>
          {value}
        </text>
      )}
    </g>
  );
}

export default function TreemapChart({ nodes, palette, animate, density }) {
  const colors = palette || build_palette(null);
  const size = density || chart_density();
  return (
    <ResponsiveContainer width="100%" height={size.height}>
      <Treemap data={nodes} dataKey="value" nameKey="name" isAnimationActive={animate !== false} animationDuration={700} animationEasing="ease-out" content={<TreemapCell palette={colors} fontSize={Math.max(9, size.font)} />}>
        <Tooltip contentStyle={colors.tooltip} itemStyle={colors.tooltip_text} labelStyle={colors.tooltip_text} formatter={(value, name) => [value, name]} />
      </Treemap>
    </ResponsiveContainer>
  );
}
