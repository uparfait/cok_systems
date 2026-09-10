import React from "react";
import WidgetCard from "./WidgetCard.jsx";

// Flexible auto-grow grid: every card carries a size-based flex-basis, and
// `grow` lets the items of an incomplete last row stretch over the leftover
// width instead of leaving an empty gap. NO widget may claim a full row of
// its own - every base width is at most half the board, so something can
// always sit next to it; a widget only ever spans the full width when
// nothing else shares its row (the odd one out, or a one-widget board).
// Static class strings so Tailwind keeps them; mobile is one column.
const HALF_ROW = "grow basis-full sm:basis-[calc(50%-0.75rem)]";
const SIZE_CLASSES = {
  small: `${HALF_ROW} xl:basis-[calc(25%-0.75rem)]`,
  medium: HALF_ROW,
  large: HALF_ROW,
  full: HALF_ROW,
};

/**
 * The board itself: KPI cards first in their own DENSE grid - 2 per row on
 * phones, 3 on tablets, 4 on large screens, each card staying low (only a
 * description adds height) - then every chart in the flexible auto-grow
 * grid below.
 */
export default function BoardGrid({
  widgets,
  dataByWidget,
  dataLoading,
  fitMode,
  editable,
  savingWidgetId,
  onUpdateWidget,
  onRemoveWidget,
  onRetryWidget,
  onShowSkipped,
}) {
  const kpi_widgets = widgets.filter((widget) => widget.chart_type === "kpi");
  const chart_widgets = widgets.filter((widget) => widget.chart_type !== "kpi");

  const render_card = (widget) => (
    <WidgetCard
      widget={widget}
      data={dataByWidget[widget.id]}
      loading={dataLoading && !dataByWidget[widget.id]}
      fitMode={fitMode}
      editable={editable}
      savingText={savingWidgetId === widget.id}
      onUpdateText={(changes) => onUpdateWidget(widget.id, changes)}
      onRemove={editable ? () => onRemoveWidget(widget) : undefined}
      onChangeType={editable ? (next_type) => onUpdateWidget(widget.id, { chart_type: next_type }) : undefined}
      onRetry={() => onRetryWidget(widget)}
      onShowSkipped={onShowSkipped}
    />
  );

  return (
    <>
      {kpi_widgets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-3">
          {kpi_widgets.map((widget) => (
            <div key={widget.id}>{render_card(widget)}</div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-stretch gap-3">
        {chart_widgets.map((widget) => (
          <div
            key={widget.id}
            // A lone widget always spans the whole board - a small card
            // floating in empty space reads as broken, not minimal.
            className={chart_widgets.length === 1 ? SIZE_CLASSES.full : SIZE_CLASSES[widget.size] || SIZE_CLASSES.medium}
          >
            {render_card(widget)}
          </div>
        ))}
      </div>
    </>
  );
}
