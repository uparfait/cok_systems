import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import CategoryCharts from "./charts/CategoryCharts.jsx";
import TimeCharts from "./charts/TimeCharts.jsx";
import PieCharts from "./charts/PieCharts.jsx";
import PointCharts from "./charts/PointCharts.jsx";
import { HeatmapChart, WaffleChart } from "./charts/GridCharts.jsx";
import TreemapChart from "./charts/TreemapChart.jsx";
import MapChart from "./charts/MapChart.jsx";
import KpiCard from "./charts/KpiCard.jsx";
import DimensionTotals from "./charts/DimensionTotals.jsx";
import { build_palette } from "./appearance.js";
import { useBoardTheme } from "./boardTheme.jsx";
import { chart_density } from "./charts/density.js";

const OTHER_KEY = "__other__";
// The single row a widget with nothing to group by draws.
const TOTAL_KEY = "__total__";
// How many values a long chart opens with, before "Show more".
const PREVIEW_COUNT = 5;
// Every value of these is a share of the same whole, so hiding one would
// misstate the others: they always draw every value they were given.
const WHOLE_OF_TOTAL = ["pie", "donut", "waffle"];

/**
 * Renders one widget's data with the right chart component. The backend
 * folds category tails into an internal "__other__" row - translated to a
 * readable label here, and CLICKABLE: clicking the Other mark (or the
 * expander line under the chart) swaps the card to a bar view of everything
 * folded inside it, with a way back.
 *
 * A chart of many values opens with the first few and a "Show more" line
 * under it, which shows the rest and turns into "Show less". Charts whose
 * every value is a share of one whole (pie, donut, waffle) draw all of
 * them, and so does a chart over time - a shortened axis would read as a
 * shorter period.
 *
 * Under every legend sits the count line: how many different values each
 * choice field the widget reads holds under the same filters.
 */
export default function WidgetChart({ widget, data, fitMode, animate, cardWidth, fillHeight, onPick }) {
  const { translate } = useDcsLanguage();
  const [show_other, setShowOther] = useState(false);
  const [show_all, setShowAll] = useState(false);
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
  const total_label = translate("DCS_DB_TOTAL");
  const readable = (label) => (label === OTHER_KEY ? other_label : label === TOTAL_KEY ? total_label : label);
  const rows = (data.rows || []).map((row) => ({ ...row, label: readable(row.label) }));
  // The first few values of a long chart, and the line that opens the rest.
  const keeps_all = WHOLE_OF_TOTAL.includes(widget.chart_type);
  const cap = (list) => (keeps_all || show_all || list.length <= PREVIEW_COUNT ? list : list.slice(0, PREVIEW_COUNT));
  const more_link = (list) =>
    !keeps_all && list.length > PREVIEW_COUNT ? (
      <button
        type="button"
        className="block text-xs px-1"
        style={{ color: palette.number, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "'Montserrat', sans-serif" }}
        onClick={() => setShowAll(!show_all)}
      >
        {show_all ? translate("DCS_DB_SHOW_LESS") : translate("DCS_DB_SHOW_MORE", { count: list.length - PREVIEW_COUNT })}
      </button>
    ) : null;
  const other_rows = Array.isArray(data.other_rows) ? data.other_rows : [];
  const can_expand_other = data.other_folded === true && other_rows.length > 0;
  // A click on a category (bar, column, slice, tile, legend entry): the
  // folded "Other" opens instead of picking; anything else picks those records.
  const handle_item_click =
    can_expand_other || onPick
      ? (row) => {
          if (!row) return;
          if (can_expand_other && row.label === other_label) {
            setShowOther(true);
            return;
          }
          if (onPick) onPick({ kind: "category", label: row.label, series: row.series, pattern: row.pattern, record_key: row.record_key, shared: row.shared });
        }
      : undefined;
  // A legend entry: its label, and on an occurrence card the counted value it stands for.
  const legend_pick = onPick ? (entry) => onPick(entry && typeof entry === "object" ? { kind: "legend", label: entry.label, record_key: entry.record_key, shared: entry.shared } : { kind: "legend", label: entry }) : undefined;

  if (data.kind === "kpi") {
    const legend = data.legend || [];
    return (
      <div>
        <KpiCard
          value={data.value}
          changePct={data.change_pct}
          legend={cap(legend)}
          totalLabel={translate(data.occurrences ? (data.occurrences.has_rule ? "DCS_DB_OCC_VALUES_MATCHING" : "DCS_DB_OCC_VALUES") : "DCS_DB_TOTAL")}
          palette={palette}
          density={density}
          onLegendClick={legend_pick}
        />
        {more_link(legend)}
      </div>
    );
  }
  if (data.kind === "point") {
    return (
      <div>
        <PointCharts chartType={widget.chart_type} points={data.points} xLabel="x" yLabel="y" palette={palette} animate={animate} density={density} onItemClick={onPick ? (point) => onPick({ kind: "point", x: point.x, y: point.y }) : undefined} />
        <DimensionTotals totals={data.totals} palette={palette} />
      </div>
    );
  }
  if (data.kind === "tree") {
    const nodes = (data.nodes || []).map((node) => ({ ...node, name: readable(node.name) }));
    return (
      <div>
        <TreemapChart nodes={cap(nodes)} palette={palette} animate={animate} density={density} onItemClick={onPick ? (node) => onPick({ kind: "tree", name: node.name, parent: node.parent, depth: node.depth, record_key: node.record_key, shared: node.shared }) : undefined} />
        {more_link(nodes)}
        <DimensionTotals totals={data.totals} palette={palette} />
      </div>
    );
  }
  if (data.kind === "time") {
    return (
      <div>
        <TimeCharts chartType={widget.chart_type} rows={rows} series={data.series || []} fitMode={fitMode} palette={palette} animate={animate} density={density} onItemClick={onPick ? (label) => onPick({ kind: "time", label }) : undefined} onLegendClick={legend_pick} />
        <DimensionTotals totals={data.totals} palette={palette} />
      </div>
    );
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

  // A map is asked for by name, so it never takes the capped rows: every
  // place with an answer is drawn, and its own legend folds the long list.
  if (widget.chart_type === "map") {
    return (
      <div>
        <MapChart
          rows={rows}
          series={data.series || []}
          level={(widget.map && widget.map.level) || "district"}
          marker={(widget.map && widget.map.marker) || null}
          showMarkers={!!(widget.map && widget.map.show_markers)}
          showLabels={!(widget.map && widget.map.show_labels === false)}
          heatmap={!!(widget.map && widget.map.heatmap)}
          palette={palette}
          density={density}
          animate={animate}
          onItemClick={handle_item_click}
          onLegendClick={legend_pick}
        />
        <DimensionTotals totals={data.totals} palette={palette} />
      </div>
    );
  }

  const shown_rows = cap(rows);
  let chart = null;
  if (widget.chart_type === "line" || widget.chart_type === "area") {
    // A category chart flipped into a line/area look: the categories run
    // along the X axis (with one line per split value when the data is
    // split) - same rows/series shape the time renderer already draws.
    chart = <TimeCharts chartType={widget.chart_type} rows={shown_rows} series={data.series || []} fitMode={fitMode} palette={palette} animate={animate} density={density} onItemClick={handle_item_click ? (label) => handle_item_click({ label }) : undefined} onLegendClick={legend_pick} />;
  } else if (widget.chart_type === "pie" || widget.chart_type === "donut") {
    chart = <PieCharts chartType={widget.chart_type} rows={shown_rows} totalLabel={translate("DCS_DB_TOTAL")} onItemClick={handle_item_click} palette={palette} animate={animate} density={density} />;
  } else if (widget.chart_type === "waffle") {
    chart = <WaffleChart rows={shown_rows} palette={palette} density={density} />;
  } else if (widget.chart_type === "heatmap") {
    chart = <HeatmapChart rows={shown_rows} series={data.series || []} fitMode={fitMode} palette={palette} density={density} onItemClick={handle_item_click ? (label, key) => handle_item_click({ label, series: key }) : undefined} />;
  } else {
    chart = (
      <CategoryCharts
        chartType={widget.chart_type}
        rows={shown_rows}
        series={data.series || []}
        seriesMeta={data.series_meta}
        onItemClick={handle_item_click}
        onLegendClick={legend_pick}
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
      {more_link(rows)}
      {can_expand_other && toggle_link("DCS_DB_OTHER_EXPAND", true, { count: other_rows.length })}
      <DimensionTotals totals={data.totals} palette={palette} />
    </div>
  );
}
