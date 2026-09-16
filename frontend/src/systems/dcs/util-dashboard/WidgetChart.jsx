import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import CategoryCharts from "./charts/CategoryCharts.jsx";
import TimeCharts from "./charts/TimeCharts.jsx";
import PieCharts from "./charts/PieCharts.jsx";
import PointCharts from "./charts/PointCharts.jsx";
import { HeatmapChart, WaffleChart } from "./charts/GridCharts.jsx";
import TreemapChart from "./charts/TreemapChart.jsx";
import KpiCard from "./charts/KpiCard.jsx";
import { build_palette } from "./appearance.js";
import { useBoardTheme } from "./boardTheme.jsx";
import { chart_density } from "./charts/density.js";

const OTHER_KEY = "__other__";

/**
 * Renders one widget's data with the right chart component. The backend
 * folds category tails into an internal "__other__" row - translated to a
 * readable label here, and CLICKABLE: clicking the Other mark (or the
 * expander line under the chart) swaps the card to a bar view of everything
 * folded inside it, with a way back.
 */
export default function WidgetChart({ widget, data, fitMode, animate, cardWidth, fillHeight }) {
  const { translate } = useDcsLanguage();
  const [show_other, setShowOther] = useState(false);
  const board = useBoardTheme();
  const palette = build_palette(widget.appearance, board.theme);
  // Everything the chart draws is sized from the card it was given, never
  // the other way round - a small widget stays small whatever it holds.
  const base_density = chart_density(cardWidth);
  // An expanded card offers more height than the profile's own: take it.
  const density = fillHeight > base_density.height ? { ...base_density, height: fillHeight, max_height: Math.max(base_density.max_height || 0, fillHeight) } : base_density;

  if (!data) return null;

  const has_rows = Array.isArray(data.rows) && data.rows.length > 0;
  const has_points = Array.isArray(data.points) && data.points.length > 0;
  const has_nodes = Array.isArray(data.nodes) && data.nodes.length > 0;
  const is_empty = data.kind === "kpi" ? false : !(has_rows || has_points || has_nodes);
  if (is_empty) {
    return (
      <div className="flex items-center justify-center text-xs" style={{ height: Math.min(180, density.height), color: palette.muted }}>
        {translate("DCS_DB_NO_DATA")}
      </div>
    );
  }

  const other_label = translate("DCS_DB_OTHER");
  const rows = (data.rows || []).map((row) => (row.label === OTHER_KEY ? { ...row, label: other_label } : row));
  const other_rows = Array.isArray(data.other_rows) ? data.other_rows : [];
  const can_expand_other = data.other_folded === true && other_rows.length > 0;
  const handle_item_click = can_expand_other
    ? (row) => {
        if (row && row.label === other_label) setShowOther(true);
      }
    : undefined;

  if (data.kind === "kpi") {
    return (
      <KpiCard
        value={data.value}
        changePct={data.change_pct}
        legend={data.legend}
        totalLabel={translate(data.occurrences ? (data.occurrences.has_rule ? "DCS_DB_OCC_VALUES_MATCHING" : "DCS_DB_OCC_VALUES") : "DCS_DB_TOTAL")}
        palette={palette}
        density={density}
      />
    );
  }
  if (data.kind === "point") {
    return <PointCharts chartType={widget.chart_type} points={data.points} xLabel="x" yLabel="y" palette={palette} animate={animate} density={density} />;
  }
  if (data.kind === "tree") {
    return <TreemapChart nodes={data.nodes} palette={palette} animate={animate} density={density} />;
  }
  if (data.kind === "time") {
    return <TimeCharts chartType={widget.chart_type} rows={rows} series={data.series || []} fitMode={fitMode} palette={palette} animate={animate} density={density} />;
  }

  const toggle_link = (label_key, next_state, vars) => (
    <button
      type="button"
      className="block text-xs px-1"
      style={{ color: palette.number, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "'Montserrat', sans-serif" }}
      onClick={() => setShowOther(next_state)}
    >
      {translate(label_key, vars)}
    </button>
  );

  // The inside of "Other": every folded row, as readable horizontal bars,
  // with "View less" above and below to fold it back.
  if (show_other && can_expand_other) {
    return (
      <div>
        {toggle_link("DCS_DB_OTHER_BACK", false)}
        <CategoryCharts chartType="bar" rows={other_rows.map((row) => ({ label: String(row.label), value: row.value }))} series={[]} palette={palette} density={density} fitMode={fitMode} />
        {toggle_link("DCS_DB_OTHER_BACK", false)}
      </div>
    );
  }

  let chart = null;
  if (widget.chart_type === "line" || widget.chart_type === "area") {
    // A category chart flipped into a line/area look: the categories run
    // along the X axis (with one line per split value when the data is
    // split) - same rows/series shape the time renderer already draws.
    chart = <TimeCharts chartType={widget.chart_type} rows={rows} series={data.series || []} fitMode={fitMode} palette={palette} animate={animate} density={density} />;
  } else if (widget.chart_type === "pie" || widget.chart_type === "donut") {
    chart = <PieCharts chartType={widget.chart_type} rows={rows} totalLabel={translate("DCS_DB_TOTAL")} onItemClick={handle_item_click} palette={palette} animate={animate} density={density} />;
  } else if (widget.chart_type === "waffle") {
    chart = <WaffleChart rows={rows} palette={palette} density={density} />;
  } else if (widget.chart_type === "heatmap") {
    chart = <HeatmapChart rows={rows} series={data.series || []} fitMode={fitMode} palette={palette} density={density} />;
  } else {
    chart = (
      <CategoryCharts
        chartType={widget.chart_type}
        rows={rows}
        series={data.series || []}
        seriesMeta={data.series_meta}
        onItemClick={handle_item_click}
        palette={palette}
        animate={animate}
        density={density}
        fitMode={fitMode}
        legendLabels={{ split: translate("DCS_DB_LEGEND_COLORS"), pattern: translate("DCS_DB_LEGEND_TEXTURES") }}
      />
    );
  }

  return (
    <div>
      {chart}
      {can_expand_other && toggle_link("DCS_DB_OTHER_EXPAND", true, { count: other_rows.length })}
    </div>
  );
}
