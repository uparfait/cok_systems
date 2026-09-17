import React from "react";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { build_palette } from "../appearance.js";
import { chart_density } from "./density.js";
import { fit_text } from "./chartLabels.jsx";

/**
 * Custom cell so every rectangle carries a readable label whenever it is
 * large enough for one (and its number alone when only that fits), tinted
 * by its root branch so siblings read as one family - unless the tile's own
 * value was given a color in the widget's appearance, which always wins.
 * A label is drawn only when its rectangle can hold it, so nothing ever
 * spills over a neighbouring tile.
 */
function TreemapCell(props) {
  const { x, y, width, height, name, value, root, index, depth, palette, fontSize, onPick, record_key, shared } = props;
  const parent = root && root.name !== undefined && root.name !== name ? root.name : null;
  const click = onPick && name !== undefined ? () => onPick({ name, parent, depth, record_key, shared }) : undefined;
  // A NESTED treemap tints a whole branch alike, so siblings read as one
  // family; a FLAT one - which is what a treemap of one field is - gives
  // every tile its own color. The two are told apart by the root: the
  // synthetic root of a flat treemap carries no name. Asking the root for
  // the color either way is what painted every tile of every flat treemap
  // the same first color of the palette.
  const branch = root && root.name !== undefined && root.name !== null ? root : null;
  const color_index = branch && typeof branch.index === "number" ? branch.index : index || 0;
  const color_label = branch ? branch.name : name;
  // Whatever this tile's own value was given in the widget's colors always
  // wins, family or not.
  const own_color = palette.color_override ? palette.color_override(name) : null;
  // Measured, so a name is either shown whole or trimmed to what truly
  // fits the tile - never drawn over its neighbour.
  const label = fit_text(name, width - 10, fontSize);
  const show_label = height > fontSize * 2.2 && label !== "";
  // A tile too small for its name still carries its number.
  const value_only = !show_label && height > fontSize * 1.5 && width > fontSize * 1.8;
  return (
    <g onClick={click} style={click ? { cursor: "pointer" } : undefined}>
      <rect x={x} y={y} width={width} height={height} style={{ fill: own_color || palette.color_for(color_label, color_index), stroke: palette.background_solid || palette.background, strokeWidth: 2 }} />
      {show_label && (
        <text x={x + 5} y={y + fontSize + 3} fill="#FFFFFF" fontSize={fontSize} fontWeight={600}>
          {label}
        </text>
      )}
      {show_label && height > fontSize * 3.2 && (
        <text x={x + 5} y={y + fontSize * 2.4 + 3} fill="rgba(255,255,255,0.85)" fontSize={fontSize}>
          {value}
        </text>
      )}
      {value_only && (
        <text x={x + width / 2} y={y + height / 2} fill="#FFFFFF" fontSize={fontSize} fontWeight={600} textAnchor="middle" dominantBaseline="central">
          {value}
        </text>
      )}
    </g>
  );
}

export default function TreemapChart({ nodes, palette, animate, density, onItemClick }) {
  const colors = palette || build_palette(null);
  const size = density || chart_density();
  return (
    <ResponsiveContainer width="100%" height={size.height}>
      <Treemap data={nodes} dataKey="value" nameKey="name" isAnimationActive={animate !== false} animationDuration={700} animationEasing="ease-out" content={<TreemapCell palette={colors} fontSize={Math.max(9, size.font)} onPick={onItemClick} />}>
        <Tooltip contentStyle={colors.tooltip} itemStyle={colors.tooltip_text} labelStyle={colors.tooltip_text} formatter={(value, name) => [value, name]} />
      </Treemap>
    </ResponsiveContainer>
  );
}
