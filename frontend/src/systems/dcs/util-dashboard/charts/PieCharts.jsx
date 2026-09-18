import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { build_palette } from "../appearance.js";
import { chart_density } from "./density.js";
import { LegendRow, LegendFrame } from "./SeriesLegend.jsx";

/**
 * Pie and donut renderers. The ring is sized from the card's own width
 * (see density.js) so its outside labels always land inside the card - on
 * a narrow card, where there is no room around the ring, each number is
 * written inside its own slice instead (and the legend carries them all).
 * The donut shows the total in its hole. Slice colors follow the widget's
 * per-value colors, text its light or dark mode.
 *
 * Its legend sits wherever the widget's appearance puts it, unchanged.
 */
/** A number written inside its slice, for rings with no room around them. */
function inside_label(size, colors, rows) {
  return (props) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, value, percent, index } = props;
    if (!value || percent < 0.04) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const radians = -(midAngle * Math.PI) / 180;
    // Written on the slice, so it is read against the slice's own color -
    // a number in white on a pale yellow wedge is not there at all.
    const slice = rows[index] ? colors.color_for(rows[index].label, index) : colors.accent;
    return (
      <text x={cx + radius * Math.cos(radians)} y={cy + radius * Math.sin(radians)} fill={colors.on_mark(slice)} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(9, size.value_font || size.font)} fontWeight={700}>
        {colors.number_text(value)}
      </text>
    );
  };
}

export default function PieCharts({ chartType, rows, totalLabel, onItemClick, palette, animate, density }) {
  const colors = palette || build_palette(null);
  const size = density || chart_density();
  const total = rows.reduce((sum, row) => sum + (row.value || 0), 0);
  const is_donut = chartType === "donut";
  const chart_height = Math.max(120, size.height - 60);
  const handle_click = onItemClick ? (entry) => onItemClick(entry && entry.payload ? entry.payload : entry) : undefined;
  // Outside labels need room around the ring; a narrow card has none.
  const with_labels = size.show_values && size.width >= 340;

  const legend = <LegendRow items={rows.map((row, index) => ({ label: row.label, color: colors.color_for(row.label, index), value: row.value || 0 }))} palette={colors} onItemClick={onItemClick ? (label) => onItemClick({ label }) : undefined} />;
  return (
    <LegendFrame position={colors.legend_position} density={size} legend={legend}>
      <div className="relative" style={{ height: chart_height, maxWidth: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="label"
              innerRadius={is_donut ? "55%" : 0}
              outerRadius={with_labels ? size.pie : "78%"}
              paddingAngle={rows.length > 1 ? 2 : 0}
              isAnimationActive={false}
              label={with_labels ? ({ value, percent }) => `${colors.number_text(value)} (${Math.round(percent * 100)}%)` : inside_label(size, colors, rows)}
              labelLine={with_labels ? { strokeWidth: 1 } : false}
              stroke={colors.background}
              cursor={handle_click ? "pointer" : undefined}
              onClick={handle_click}
            >
              {rows.map((row, index) => (
                <Cell key={row.label} fill={colors.color_for(row.label, index)} />
              ))}
            </Pie>
            <Tooltip contentStyle={colors.tooltip} itemStyle={colors.tooltip_text} labelStyle={colors.tooltip_text} />
          </PieChart>
        </ResponsiveContainer>
        {is_donut && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-bold" style={{ color: colors.number, fontFamily: "'Montserrat', sans-serif", fontSize: Math.max(15, Math.round(size.height / 12)) }}>
              {total}
            </span>
            <span style={{ color: colors.muted, fontSize: size.font }}>{totalLabel}</span>
          </div>
        )}
      </div>
    </LegendFrame>
  );
}
