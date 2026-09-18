import React, { useCallback, useState } from "react";
import BoardContextMenu from "./BoardContextMenu.jsx";
import { default_box } from "./boxLayout.js";

/**
 * The right-click behaviour of a board, and the canvases it creates.
 *
 * A CANVAS is free space on the board that other widgets sit inside. It is
 * made from the board's own right-click menu, because that is where a
 * person is when they notice they want one - "put something here" - rather
 * than three steps into a builder.
 *
 * Right-clicking a widget offers the same menu narrowed to that widget:
 * its settings (colors, border, and inside a canvas its size and place),
 * reconfiguring what it charts, and - on a canvas - putting a widget in
 * it. Everything here needs an editable board; a viewer's right-click is
 * left to the browser.
 *
 * STUDIO MODE is always the first entry, wherever the right-click landed.
 * It is the one mode the board has: inside it widgets are selected, moved,
 * placed, resized, edited together and deleted, all on a working copy that
 * reaches the server only when the bar in the corner saves it. Nothing
 * else is offered while it is on, because everything else writes straight
 * past the copy the mode is holding.
 */

let canvas_sequence = 0;

/**
 * A brand new, empty canvas, ready to be dropped on a board or into
 * another one. It is created UNNAMED and undescribed: a section is a piece
 * of the page's layout, so a title is something you add when the group
 * needs one, not a word the board puts there for you.
 */
export function new_canvas_widget(form, title, parent_id) {
  canvas_sequence += 1;
  return {
    id: `w_canvas_${Date.now().toString(36)}_${canvas_sequence}`,
    form_group_id: form.form_group_id,
    title: title || "",
    description: null,
    icon: null,
    chart_type: "canvas",
    metric: { aggregation: "count", field_id: null },
    group_by: null,
    split_by: null,
    pattern_by: null,
    legend_by: null,
    appearance: null,
    x_field_id: null,
    y_field_id: null,
    size_field_id: null,
    filters: [],
    period: { preset: "all", from: null, to: null },
    sort: "value_desc",
    limit: 12,
    // A canvas is a place, so it takes a whole row of the board unless it
    // is itself inside one.
    size: "large",
    canvas: { flow: "row", gap: 12, place: "flow", width: null, height: null },
    parent_id: parent_id || null,
    box: parent_id ? default_box() : null,
    position: 0,
  };
}

export function useBoardCanvas({ form, editable, isDark, arranging, studio, onAdd, onSettings, onReconfigure, onAddWidget, onRemove }) {
  const [menu, setMenu] = useState(null);
  const close = useCallback(() => setMenu(null), []);

  const open_board_menu = (event) => {
    // The way into studio mode must be reachable even where nothing else
    // so the menu opens for it alone rather than not at all.
    if (!editable && !studio) return;
    // Only the board's own empty space: a right-click that landed on a
    // widget is that widget's business and has already been handled.
    if (event.defaultPrevented) return;
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, widget: null, dark: isDark });
  };

  const open_widget_menu = (event, widget) => {
    if (!editable && !studio) return;
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, widget, dark: isDark });
  };

  // A new section is handed to the board to SAVE, not just to show: the
  // board says it is adding, stores it, and answers when it has.
  const add_canvas = (parent_id) => onAdd(new_canvas_widget(form, "", parent_id));

  const target = menu ? menu.widget : null;
  const is_canvas = !!target && target.chart_type === "canvas";
  // While STUDIO MODE is on it is the only thing on offer: the rest of
  // these would commit straight to the board behind the working copy the
  // mode is holding.
  const items = arranging
    ? [
        { key: "studio", labelKey: "DCS_DB_STUDIO_LEAVE", strong: true, onPick: () => studio.toggle() },
        studio && studio.arrangement
          ? { key: "arrangement", labelKey: studio.is_studio() ? "DCS_DB_STUDIO_GRID" : "DCS_DB_STUDIO_FREE", onPick: () => studio.arrangement() }
          : null,
      ]
    : [
        studio ? { key: "studio", labelKey: "DCS_DB_STUDIO_ENTER", strong: true, onPick: () => studio.toggle() } : null,
        editable ? { key: "canvas", labelKey: is_canvas ? "DCS_DB_CANVAS_ADD_INSIDE" : "DCS_DB_CANVAS_ADD_EMPTY", onPick: () => add_canvas(is_canvas ? target.id : null) } : null,
        editable && is_canvas && onAddWidget ? { key: "add", labelKey: "DCS_DB_CANVAS_ADD", onPick: () => onAddWidget(target) } : null,
        editable && target && onSettings ? { key: "settings", labelKey: "DCS_DB_COLOR_SETTINGS", onPick: () => onSettings(target) } : null,
        editable && target && !is_canvas && onReconfigure ? { key: "reconfigure", labelKey: "DCS_DB_RECONFIGURE", onPick: () => onReconfigure(target) } : null,
        // Last, because it is the one that cannot be taken back. A section
        // that still holds widgets is refused with a count of them.
        editable && target && onRemove ? { key: "remove", labelKey: "DCS_DB_REMOVE_WIDGET", onPick: () => onRemove(target) } : null,
      ];

  return {
    open_board_menu,
    open_widget_menu,
    add_canvas,
    menu_element: <BoardContextMenu at={menu} items={items} onClose={close} />,
  };
}
