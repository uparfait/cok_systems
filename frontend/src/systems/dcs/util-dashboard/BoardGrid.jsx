import React, { useState } from "react";
import WidgetCard from "./WidgetCard.jsx";
import CanvasWidget from "./CanvasWidget.jsx";
import { canvas_frame, canvas_flex, is_rest } from "./boxLayout.js";
import CanvasFrame from "./CanvasFrame.jsx";
import BoardFreeSurface from "./BoardFreeSurface.jsx";
import { is_studio } from "./boxLayout.js";
import ExpandableSlot from "./ExpandableSlot.jsx";
import { build_palette } from "./appearance.js";
import { row_class } from "./boardRows.js";
import { drill_target, field_label } from "./cascade.js";
import { useBoardTheme } from "./boardTheme.jsx";
import { useBoardColors } from "./boardColors.jsx";

// A zero-height full-width item, which is how flex-wrap is made to break
// a line where it is told rather than only where it runs out of room.
const ROW_BREAK = { flexBasis: "100%", height: 0 };

/**
 * The board itself: ONE flowing grid, KPI cards first and then the charts,
 * each widget claiming the share of a row its own size asks for (see
 * boardRows.js) and taking a new row only when it genuinely does not fit
 * in what is left of the current one. Whatever a row ends up holding
 * widens evenly to fill it, so no gap is ever left at the end - and
 * because cards and charts flow together, two cards and a chart share one
 * row while twelve cards keep it to themselves. With `studio` each card is
 * draggable onto another to move it there, placed and sized by hand when
 * the board is arranged as a surface, and removable; inline editing is off
 * meanwhile. Every card sits in an ExpandableSlot: its hover button grows
 * the card to fill the screen above the others and back - one at a time.
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
  studio,
  onOpenRecords,
  mapLevels,
  heatField,
  // The form's own fields, for the clock an "over time" widget follows.
  fields,
  onReconfigure,
  // "Date & filters" of one widget, and another page of a table widget.
  onBehavior,
  onTablePage,
  // Going a level down a cascade.
  onDrill,
  // Canvases: dropping a widget into one, and the right-click menu.
  onAddToCanvas,
  onWidgetMenu,
  // How the whole board is arranged: the grid, or studio.
  layout,
}) {
  const [dragging_id, setDraggingId] = useState(null);
  const [over_id, setOverId] = useState(null);
  const [expanded_id, setExpandedId] = useState(null);
  const board = useBoardTheme();
  const board_colors = useBoardColors();
  // A widget that the board filters leave with nothing to show (a KPI with
  // no total and no legend, a chart with no rows, points or nodes) hides
  // until the filters change - an empty card would only say that the
  // filters excluded it, and a widget whose own fixed filters contradict
  // the board's would sit there confusing everyone. Nothing is said about
  // the hidden ones - the filter bar already says what is in view.
  const emptied_by_filters = (widget) => {
    const entry = dataByWidget[widget.id];
    if (!entry || entry.error || entry.locked || !Array.isArray(entry.board_context) || entry.board_context.length === 0) return false;
    // A table says for itself when nothing matched, in its own empty row.
    if (entry.kind === "table") return false;
    if (entry.kind === "kpi") return !(Number(entry.value) > 0) && !(Array.isArray(entry.legend) && entry.legend.length > 0);
    const has = (list) => Array.isArray(list) && list.length > 0;
    return !has(entry.rows) && !has(entry.points) && !has(entry.nodes) && !has(entry.items);
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
  const is_canvas = (widget) => widget.chart_type === "canvas";
  // A SECTION is not small, medium or large: it is as wide and as tall as
  // it was told to be, and it sits where it was put. Given no width it
  // takes the board, because a section is a band of the page rather than a
  // card sharing a row.
  // A section on the board answers to the BOARD: 100% wide is the whole
  // dashboard, and NOTHING makes it wider - a section keeps the same edges
  // as every widget beside it, or it reads as a mistake against them. One
  // inside another canvas is drawn by that canvas and never reaches here.
  const canvas_box = (widget) => {
    if (!is_canvas(widget)) return undefined;
    const settings = widget.canvas || {};
    const frame = canvas_frame(settings);
    // Told nothing, a section takes the board. Told to take the rest, the
    // flex plumbing decides and no width is written here. Either way it is
    // held to the board's own width.
    if (is_rest(settings.width)) return Object.assign({}, frame, { width: undefined, maxWidth: "100%" });
    return Object.assign({}, frame, { width: frame.width || "100%", maxWidth: "100%" });
  };
  // Sizing a section is an EDIT, and edits are collected before they are
  // sent: the grips only appear in studio mode, where what they write
  // waits on the working copy until the bar at the corner saves it.
  const canvas_resize = (widget) =>
    studio && studio.onResize ? (changes) => studio.onResize(widget.id, Object.assign({}, widget.canvas || {}, changes)) : undefined;
  const canvas_item = (widget) => Object.assign({ flexGrow: 0, flexBasis: "auto", flexShrink: 1 }, canvas_box(widget), canvas_flex(widget.canvas));
  const kpi_widgets = widgets.filter((widget) => on_board(widget) && widget.chart_type === "kpi" && !emptied_by_filters(widget));
  const chart_widgets = widgets.filter((widget) => on_board(widget) && widget.chart_type !== "kpi" && !emptied_by_filters(widget));
  const arranging = !!studio;
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
        // Free placement is an edit like any other size: only in studio
        // mode, and held on the working copy until it is saved.
        placeable={!!(studio && studio.onPlace)}
        onPlace={studio && studio.onPlace ? studio.onPlace : undefined}
        onRemove={studio && studio.onRemove ? studio.onRemove : undefined}
        onAddWidget={editable && onAddToCanvas ? () => onAddToCanvas(widget) : undefined}
        dragPropsFor={arranging ? drag_props : undefined}
        dropClass={item_class}
      >
        {(children_of.get(widget.id) || []).map((child) => ({ widget: child, node: render_card(child) }))}
      </CanvasWidget>
    );

  // Everything a widget can do, handed to the menu a right click (or a
  // double click) opens. The card itself carries no control for any of it.
  const menu_actions = (widget) => {
    const entry = dataByWidget[widget.id];
    const has_data = !!entry && !entry.error && !entry.locked;
    const target = drill_target(widget, fields || []);
    const wordless = is_canvas(widget) || widget.chart_type === "text";
    return {
      onOpenRecords: onOpenRecords && has_data && !wordless ? () => onOpenRecords(widget, null) : undefined,
      onDrill: onDrill && target ? () => onDrill(widget) : undefined,
      drillChild: target ? field_label(target.child) : "",
      onExpand: is_canvas(widget) ? undefined : () => setExpandedId((current) => (current === widget.id ? null : widget.id)),
      expanded: expanded_id === widget.id,
    };
  };

  const render_card = (widget) => (
    // A SECTION carries no "view full" button. It is the page's own layout,
    // not a card with something in it worth filling the screen with - the
    // widgets inside it each keep their own button.
    <ExpandableSlot expanded={expanded_id === widget.id} onToggle={() => setExpandedId((current) => (current === widget.id ? null : widget.id))} palette={build_palette(widget.appearance, board.theme, board_colors)}>
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
      onBehavior={editable && onBehavior ? () => onBehavior(widget) : undefined}
      onTablePage={onTablePage}
      onDrill={onDrill && drill_target(widget, fields || []) ? () => onDrill(widget) : undefined}
      drillChild={(() => {
        const target = drill_target(widget, fields || []);
        return target ? field_label(target.child) : null;
      })()}
      slot={canvas_slot(widget)}
      onContextMenu={onWidgetMenu ? (event) => onWidgetMenu(event, widget, menu_actions(widget)) : undefined}
      onChangeSize={editable ? (next_size) => onUpdateWidget(widget.id, { size: next_size }) : undefined}
      onRetry={() => onRetryWidget(widget)}
      onShowSkipped={onShowSkipped}
      onPickIcon={editable && onPickIcon ? () => onPickIcon(widget) : undefined}
      onAppearance={editable && onAppearance ? () => onAppearance(widget) : undefined}
      expanded={expanded_id === widget.id || is_studio(layout)}
      onExpand={is_canvas(widget) || arranging ? undefined : () => setExpandedId((current) => (current === widget.id ? null : widget.id))}
      onOpenRecords={onOpenRecords ? (pick) => onOpenRecords(widget, pick) : undefined}
    />
    </ExpandableSlot>
  );

  // Drag-and-drop reordering, active only in studio mode.
  const drag_props = (widget) =>
    arranging
      ? {
          draggable: true,
          onDragStart: (event) => {
            // The innermost thing grabbed is the thing that moves: a
            // widget inside a section must not drag the section with it.
            event.stopPropagation();
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", widget.id);
            setDraggingId(widget.id);
          },
          onDragEnd: (event) => {
            event.stopPropagation();
            setDraggingId(null);
            setOverId(null);
          },
          onDragOver: (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = "move";
            if (over_id !== widget.id) setOverId(widget.id);
          },
          onDragLeave: () => setOverId((current) => (current === widget.id ? null : current)),
          onDrop: (event) => {
            event.preventDefault();
            // Dropped ON this one, so this one is the destination - the
            // section behind it does not get a second say.
            event.stopPropagation();
            const from_id = event.dataTransfer.getData("text/plain") || dragging_id;
            studio.onMove(from_id, widget.id);
            setDraggingId(null);
            setOverId(null);
          },
        }
      : {};

  // min-w-0 is what makes a chosen size stick: without it a flex item
  // refuses to shrink below its content, so one wide chart would drag its
  // whole card past the width its size asked for.
  const item_class = (widget) =>
    `min-w-0 max-w-full ${dragging_id === widget.id ? "is-dragging" : ""} ${over_id === widget.id && dragging_id && dragging_id !== widget.id ? "is-drop-target" : ""}`;

  // STUDIO: no rows, no shares of a row - every widget on the board sits
  // where it was put, at the size it was given, stacked as the author
  // stacked it, and the whole surface scales down on a smaller screen so
  // the arrangement survives rather than reflowing into something else.
  if (is_studio(layout)) {
    return (
      <BoardFreeSurface
        list={kpi_widgets.concat(chart_widgets).map((widget) => ({ widget, node: render_card(widget) }))}
        layout={layout}
        placeable={!!(studio && studio.onPlace)}
        onPlace={studio && studio.onPlace ? studio.onPlace : undefined}
        onRemove={studio && studio.onRemove ? studio.onRemove : undefined}
      />
    );
  }

  // A board holding a single CHART gives it the whole row: one small
  // drawing floating in empty space reads as broken. A card is a card -
  // it keeps the share its size asked for, and widens to fill its row
  // like every other.
  const lone_chart = kpi_widgets.length === 0 && chart_widgets.length === 1 && !is_canvas(chart_widgets[0]) ? chart_widgets[0] : null;
  return (
    <>
      <div>
        <div className="flex flex-wrap items-stretch gap-3">
          {kpi_widgets.concat(chart_widgets).map((widget) => {
            if (!is_canvas(widget)) {
              return (
                <div
                  key={widget.id}
                  className={`${row_class(widget, widget === lone_chart)} ${item_class(widget)}`}
                  {...drag_props(widget)}
                >
                  {render_card(widget)}
                </div>
              );
            }
            return (
              <React.Fragment key={widget.id}>
                {/* A section always begins a line of its own: it is a band
                    of the page, not a card sharing a row with charts. */}
                <span aria-hidden="true" style={ROW_BREAK} />
                <CanvasFrame widget={widget} className={`grow-0 ${item_class(widget)}`} style={canvas_item(widget)} dragProps={drag_props(widget)} onResize={canvas_resize(widget)}>
                  {render_card(widget)}
                </CanvasFrame>
                <span aria-hidden="true" style={ROW_BREAK} />
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </>
  );
}
