import React, { useState } from "react";
import WidgetCard from "./WidgetCard.jsx";
import ExpandableSlot from "./ExpandableSlot.jsx";
import { build_palette } from "./appearance.js";
import { useBoardTheme } from "./boardTheme.jsx";

// Flexible auto-grow grid: a chart's own size (changed from its menu) is
// the FRACTION OF A ROW it claims, and neighbours that still fit share
// that row - small is a third (three small charts in a row on a laptop),
// medium a half (two in a row), and large a whole row to itself. A small
// beside a medium therefore fills one row between them, and `grow` widens
// whatever a row ends up holding so no gap is ever left. Mobile is always
// one column, and a lone chart always spans the board. The basis subtracts
// its share of the 0.75rem gaps so the intended count really fits. Static
// class strings so Tailwind keeps them.
const HALF_ROW = "grow basis-full sm:basis-[calc(50%-0.75rem)]";
const SIZE_CLASSES = {
  small: `${HALF_ROW} lg:basis-[calc(33.333%-0.75rem)]`,
  medium: HALF_ROW,
  large: "grow basis-full",
  full: "grow basis-full",
};

/**
 * The board itself: KPI cards first in their own DENSE grid - 2 per row on
 * phones, 3 on tablets, 4 on large screens - then every chart in the
 * flexible auto-grow grid below. With `selection` (the selection mode) each
 * card is clickable to select and draggable onto another card to move it
 * there; inline editing is off meanwhile. Every card sits in an
 * ExpandableSlot: its hover button grows the card to fill the screen above
 * the others and back - one card at a time.
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
  const [expanded_id, setExpandedId] = useState(null);
  const board = useBoardTheme();
  const kpi_widgets = widgets.filter((widget) => widget.chart_type === "kpi");
  const chart_widgets = widgets.filter((widget) => widget.chart_type !== "kpi");
  const selecting = !!selection;

  const render_card = (widget) => (
    <ExpandableSlot expanded={expanded_id === widget.id} onToggle={() => setExpandedId((current) => (current === widget.id ? null : widget.id))} hideButton={selecting} palette={build_palette(widget.appearance, board.theme)}>
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
      expanded={expanded_id === widget.id}
    />
    </ExpandableSlot>
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

  // min-w-0 is what makes a chosen size stick: without it a flex item
  // refuses to shrink below its content, so one wide chart would drag its
  // whole card past the width its size asked for.
  const item_class = (widget) =>
    `min-w-0 max-w-full ${selecting ? "dcs-selectable" : ""} ${selecting && selection.selected.has(widget.id) ? "is-selected" : ""} ${dragging_id === widget.id ? "is-dragging" : ""} ${over_id === widget.id && dragging_id && dragging_id !== widget.id ? "is-drop-target" : ""}`;

  return (
    <>
      {kpi_widgets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-3">
          {kpi_widgets.map((widget) => (
            <div key={widget.id} className={`min-w-0 ${item_class(widget)}`} {...drag_props(widget)}>
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
