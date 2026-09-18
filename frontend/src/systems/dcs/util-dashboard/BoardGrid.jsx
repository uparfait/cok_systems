import React, { useState } from "react";
import WidgetCard from "./WidgetCard.jsx";
import CanvasWidget from "./CanvasWidget.jsx";
import { css_length } from "./boxLayout.js";
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
 * The board itself: KPI cards first in their own DENSE row - 2 per row on
 * phones, 3 on tablets, 4 on large screens, and fewer cards stretch to
 * fill the row instead of huddling small - then every chart in the
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
  onOpenRecords,
  mapLevels,
  heatField,
  // The form's own fields, for the clock an "over time" widget follows.
  fields,
  onReconfigure,
  // Canvases: dropping a widget into one, and the right-click menu.
  onAddToCanvas,
  onWidgetMenu,
}) {
  const [dragging_id, setDraggingId] = useState(null);
  const [over_id, setOverId] = useState(null);
  const [expanded_id, setExpandedId] = useState(null);
  const board = useBoardTheme();
  // A widget that the board filters leave with nothing to show (a KPI with
  // no total and no legend, a chart with no rows, points or nodes) hides
  // until the filters change - an empty card would only say that the
  // filters excluded it, and a widget whose own fixed filters contradict
  // the board's would sit there confusing everyone. Nothing is said about
  // the hidden ones - the filter bar already says what is in view.
  const emptied_by_filters = (widget) => {
    const entry = dataByWidget[widget.id];
    if (!entry || entry.error || entry.locked || !Array.isArray(entry.board_context) || entry.board_context.length === 0) return false;
    if (entry.kind === "kpi") return !(Number(entry.value) > 0) && !(Array.isArray(entry.legend) && entry.legend.length > 0);
    const has = (list) => Array.isArray(list) && list.length > 0;
    return !has(entry.rows) && !has(entry.points) && !has(entry.nodes);
  };
  // A widget that names a canvas as its parent is drawn INSIDE that
  // canvas, not on the board, so the board itself only lays out the ones
  // that belong to nobody. Everything else is reached through its canvas.
  const children_of = new Map();
  widgets.forEach((widget) => {
    if (!widget.parent_id) return;
    if (!children_of.has(widget.parent_id)) children_of.set(widget.parent_id, []);
    children_of.get(widget.parent_id).push(widget);
  });
  const on_board = (widget) => !widget.parent_id;
  // A SECTION is not small, medium or large: it is as wide and as tall as
  // it was told to be. Given no width it simply takes the row, because a
  // section is a band of the page rather than a card sharing one.
  const canvas_span = (widget) => (widget.chart_type === "canvas" ? "grow-0 basis-auto" : "");
  const canvas_box = (widget) => {
    if (widget.chart_type !== "canvas") return undefined;
    const settings = widget.canvas || {};
    return { width: css_length(settings.width) || "100%", height: css_length(settings.height) || undefined };
  };
  const kpi_widgets = widgets.filter((widget) => on_board(widget) && widget.chart_type === "kpi" && !emptied_by_filters(widget));
  const chart_widgets = widgets.filter((widget) => on_board(widget) && widget.chart_type !== "kpi" && !emptied_by_filters(widget));
  const selecting = !!selection;
  // A widget can become a map when the field it groups by names a place
  // the city has boundaries for; turning into one carries that level over,
  // and turning back leaves it in place for the next time.
  const map_level_of = (widget) => (mapLevels && widget.group_by ? mapLevels.get(widget.group_by.field_id) : undefined);
  // Switching a map between its two kinds keeps what the other kind needs,
  // so a map turned to heat and back is the map it was.
  const map_of_mode = (widget, next) => {
    const held = widget.map || {};
    if (next !== "heat") return Object.assign({}, held, { mode: "world", level: held.level || (mapLevels && widget.group_by ? mapLevels.get(widget.group_by.field_id) : undefined) });
    return Object.assign({}, held, { mode: "heat", point_field_id: held.point_field_id || heatField });
  };
  const type_change = (widget, next_type) => {
    if (next_type !== "map") return { chart_type: next_type };
    const level = map_level_of(widget);
    return { chart_type: "map", map: Object.assign({ show_labels: true }, widget.map || {}, level ? { level } : {}) };
  };

  // What a canvas draws: the widgets that named it, each in its own box.
  // Recursive, because a canvas may hold a canvas.
  const canvas_slot = (widget) =>
    widget.chart_type !== "canvas" ? null : (
      <CanvasWidget
        widget={widget}
        editable={editable}
        onResize={editable ? (id, box) => onUpdateWidget(id, { box }) : undefined}
        onAddWidget={editable && onAddToCanvas ? () => onAddToCanvas(widget) : undefined}
      >
        {(children_of.get(widget.id) || []).map((child) => ({ widget: child, node: render_card(child) }))}
      </CanvasWidget>
    );

  const render_card = (widget) => (
    <ExpandableSlot expanded={expanded_id === widget.id} onToggle={() => setExpandedId((current) => (current === widget.id ? null : widget.id))} hideButton={selecting} palette={build_palette(widget.appearance, board.theme)}>
      <WidgetCard
      widget={widget}
      data={dataByWidget[widget.id]}
      loading={dataLoading && !dataByWidget[widget.id]}
      busy={dataLoading && !!dataByWidget[widget.id]}
      fitMode={fitMode}
      editable={editable}
      savingText={savingWidgetId === widget.id}
      onUpdateText={(changes) => onUpdateWidget(widget.id, changes)}
      onRemove={editable ? () => onRemoveWidget(widget) : undefined}
      onChangeType={editable ? (next_type) => onUpdateWidget(widget.id, type_change(widget, next_type)) : undefined}
      canMap={map_level_of(widget) !== undefined}
      canHeat={!!heatField}
      onMapMode={editable && widget.chart_type === "map" ? (next) => onUpdateWidget(widget.id, { map: map_of_mode(widget, next) }) : undefined}
      fields={fields}
      onOverTime={editable ? (next) => onUpdateWidget(widget.id, { over_time: next }) : undefined}
      onReconfigure={editable && onReconfigure ? () => onReconfigure(widget) : undefined}
      slot={canvas_slot(widget)}
      onContextMenu={onWidgetMenu ? (event) => onWidgetMenu(event, widget) : undefined}
      onChangeSize={editable && widget.chart_type !== "kpi" ? (next_size) => onUpdateWidget(widget.id, { size: next_size }) : undefined}
      onRetry={() => onRetryWidget(widget)}
      onShowSkipped={onShowSkipped}
      onPickIcon={editable && onPickIcon ? () => onPickIcon(widget) : undefined}
      onAppearance={editable && onAppearance ? () => onAppearance(widget) : undefined}
      selectable={selecting}
      selected={selecting && selection.selected.has(widget.id)}
      onSelect={selecting ? () => selection.onToggle(widget.id) : undefined}
      expanded={expanded_id === widget.id}
      onOpenRecords={onOpenRecords ? (pick) => onOpenRecords(widget, pick) : undefined}
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
        <div className="flex flex-wrap items-stretch gap-3 mb-3">
          {kpi_widgets.map((widget) => (
            <div key={widget.id} className={`grow basis-[calc(50%-0.75rem)] md:basis-[calc(33.333%-0.75rem)] xl:basis-[calc(25%-0.75rem)] ${item_class(widget)}`} {...drag_props(widget)}>
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
            className={`${canvas_span(widget) || (chart_widgets.length === 1 ? SIZE_CLASSES.full : SIZE_CLASSES[widget.size] || SIZE_CLASSES.medium)} ${item_class(widget)}`}
            style={canvas_box(widget)}
            {...drag_props(widget)}
          >
            {render_card(widget)}
          </div>
        ))}
      </div>
    </>
  );
}
