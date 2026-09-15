import React, { useState } from "react";
import WidgetCard from "./WidgetCard.jsx";

// Flexible auto-grow grid: every card carries a size-based flex-basis, and
// `grow` lets the items of an incomplete last row stretch over the leftover
// width instead of leaving an empty gap. A chart's own size (changed from
// its menu) decides its base width: small is a quarter of the board (a
// third on a tablet) so up to FOUR small charts share one row, medium
// half, large two thirds - so a large and a small card fill one row too. Mobile is always one column, and a
// lone chart always spans the whole board. Static class strings so
// Tailwind keeps them.
const HALF_ROW = "grow basis-full sm:basis-[calc(50%-0.75rem)]";
const SIZE_CLASSES = {
  small: `${HALF_ROW} md:basis-[calc(33.333%-0.75rem)] lg:basis-[calc(25%-0.75rem)]`,
  medium: HALF_ROW,
  large: `grow basis-full sm:basis-[calc(66.666%-0.75rem)]`,
  full: HALF_ROW,
};

/**
 * The board itself: KPI cards first in their own DENSE grid - 2 per row on
 * phones, 3 on tablets, 4 on large screens - then every chart in the
 * flexible auto-grow grid below. With `selection` (the selection mode) each
 * card is clickable to select and draggable onto another card to move it
 * there; inline editing is off meanwhile.
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
  onPickIcon,
  onAppearance,
  selection,
}) {
  const [dragging_id, setDraggingId] = useState(null);
  const [over_id, setOverId] = useState(null);
  const kpi_widgets = widgets.filter((widget) => widget.chart_type === "kpi");
  const chart_widgets = widgets.filter((widget) => widget.chart_type !== "kpi");
  const selecting = !!selection;

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
      onChangeSize={editable && widget.chart_type !== "kpi" ? (next_size) => onUpdateWidget(widget.id, { size: next_size }) : undefined}
      onRetry={() => onRetryWidget(widget)}
      onShowSkipped={onShowSkipped}
      onPickIcon={editable && onPickIcon ? () => onPickIcon(widget) : undefined}
      onAppearance={editable && onAppearance ? () => onAppearance(widget) : undefined}
      selectable={selecting}
      selected={selecting && selection.selected.has(widget.id)}
      onSelect={selecting ? () => selection.onToggle(widget.id) : undefined}
    />
  );

  // Drag-and-drop reordering, active only in the selection mode.
  const drag_props = (widget) =>
    selecting
      ? {
          draggable: true,
          onDragStart: (event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", widget.id);
            setDraggingId(widget.id);
          },
          onDragEnd: () => {
            setDraggingId(null);
            setOverId(null);
          },
          onDragOver: (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            if (over_id !== widget.id) setOverId(widget.id);
          },
          onDragLeave: () => setOverId((current) => (current === widget.id ? null : current)),
          onDrop: (event) => {
            event.preventDefault();
            const from_id = event.dataTransfer.getData("text/plain") || dragging_id;
            selection.onMove(from_id, widget.id);
            setDraggingId(null);
            setOverId(null);
          },
        }
      : {};

  const item_class = (widget) =>
    `${selecting ? "dcs-selectable" : ""} ${selecting && selection.selected.has(widget.id) ? "is-selected" : ""} ${dragging_id === widget.id ? "is-dragging" : ""} ${over_id === widget.id && dragging_id && dragging_id !== widget.id ? "is-drop-target" : ""}`;

  return (
    <>
      {kpi_widgets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-3">
          {kpi_widgets.map((widget) => (
            <div key={widget.id} className={item_class(widget)} {...drag_props(widget)}>
              {render_card(widget)}
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-stretch gap-3">
        {chart_widgets.map((widget) => (
          <div
            key={widget.id}
            // A lone widget always spans the whole board - a small card
            // floating in empty space reads as broken, not minimal.
            className={`${chart_widgets.length === 1 ? SIZE_CLASSES.full : SIZE_CLASSES[widget.size] || SIZE_CLASSES.medium} ${item_class(widget)}`}
            {...drag_props(widget)}
          >
            {render_card(widget)}
          </div>
        ))}
      </div>
    </>
  );
}
