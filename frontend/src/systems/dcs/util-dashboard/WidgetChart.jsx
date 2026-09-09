import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import CategoryCharts from "./charts/CategoryCharts.jsx";
import TimeCharts from "./charts/TimeCharts.jsx";
import PieCharts from "./charts/PieCharts.jsx";
import PointCharts from "./charts/PointCharts.jsx";
import { HeatmapChart, WaffleChart } from "./charts/GridCharts.jsx";
import TreemapChart from "./charts/TreemapChart.jsx";
import KpiCard from "./charts/KpiCard.jsx";

const OTHER_KEY = "__other__";

/**
 * Renders one widget's data with the right chart component. The backend
 * folds category tails into an internal "__other__" row - translated to a
 * readable label here, right before rendering.
 */
export default function WidgetChart({ widget, data, fitMode }) {
  const { translate } = useDcsLanguage();

  if (!data) return null;

  const has_rows = Array.isArray(data.rows) && data.rows.length > 0;
  const has_points = Array.isArray(data.points) && data.points.length > 0;
  const has_nodes = Array.isArray(data.nodes) && data.nodes.length > 0;
  const is_empty = data.kind === "kpi" ? false : !(has_rows || has_points || has_nodes);
  if (is_empty) {
    return (
      <div className="flex items-center justify-center text-xs" style={{ height: 180, color: "#9E9E9E" }}>
        {translate("DCS_DB_NO_DATA")}
      </div>
    );
  }

  const rows = (data.rows || []).map((row) =>
    row.label === OTHER_KEY ? { ...row, label: translate("DCS_DB_OTHER") } : row,
  );

  if (data.kind === "kpi") {
    return (
      <KpiCard
        value={data.value}
        previous={data.previous}
        changePct={data.change_pct}
        previousLabel={translate("DCS_DB_PREVIOUS_PERIOD")}
      />
    );
  }
  if (data.kind === "point") {
    return <PointCharts chartType={widget.chart_type} points={data.points} xLabel="x" yLabel="y" />;
  }
  if (data.kind === "tree") {
    return <TreemapChart nodes={data.nodes} />;
  }
  if (data.kind === "time") {
    return <TimeCharts chartType={widget.chart_type} rows={rows} series={data.series || []} fitMode={fitMode} />;
  }
  if (widget.chart_type === "pie" || widget.chart_type === "donut") {
    return <PieCharts chartType={widget.chart_type} rows={rows} totalLabel={translate("DCS_DB_TOTAL")} />;
  }
  if (widget.chart_type === "waffle") {
    return <WaffleChart rows={rows} />;
  }
  if (widget.chart_type === "heatmap") {
    return <HeatmapChart rows={rows} series={data.series || []} fitMode={fitMode} />;
  }
  return <CategoryCharts chartType={widget.chart_type} rows={rows} series={data.series || []} />;
}
