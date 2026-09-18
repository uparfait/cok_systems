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
 */

let canvas_sequence = 0;

/** A brand new, empty canvas, ready to be dropped on a board or into another one. */
export function new_canvas_widget(form, title, parent_id) {
  canvas_sequence += 1;
  return {
    id: `w_canvas_${Date.now().toString(36)}_${canvas_sequence}`,
    form_group_id: form.form_group_id,
    title,
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
    canvas: { flow: "row", gap: 12, height: null },
    parent_id: parent_id || null,
    box: parent_id ? default_box() : null,
    position: 0,
  };
}

export function useBoardCanvas({ form, widgets, editable, isDark, translate, onCommit, onSettings, onReconfigure, onAddWidget }) {
  const [menu, setMenu] = useState(null);
  const close = useCallback(() => setMenu(null), []);

  const open_board_menu = (event) => {
    if (!editable) return;
    // Only the board's own empty space: a right-click that landed on a
    // widget is that widget's business and has already been handled.
    if (event.defaultPrevented) return;
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, widget: null, dark: isDark });
  };

  const open_widget_menu = (event, widget) => {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, widget, dark: isDark });
  };

  const add_canvas = (parent_id) => {
    const made = new_canvas_widget(form, translate("DCS_DB_CANVAS_TITLE"), parent_id);
    onCommit(widgets.concat([made]).map((widget, index) => ({ ...widget, position: index })));
  };

  const target = menu ? menu.widget : null;
  const is_canvas = !!target && target.chart_type === "canvas";
  const items = [
    { key: "canvas", labelKey: is_canvas ? "DCS_DB_CANVAS_ADD_INSIDE" : "DCS_DB_CANVAS_ADD_EMPTY", strong: true, onPick: () => add_canvas(is_canvas ? target.id : null) },
    is_canvas && onAddWidget ? { key: "add", labelKey: "DCS_DB_CANVAS_ADD", onPick: () => onAddWidget(target) } : null,
    target && onSettings ? { key: "settings", labelKey: "DCS_DB_COLOR_SETTINGS", onPick: () => onSettings(target) } : null,
    target && !is_canvas && onReconfigure ? { key: "reconfigure", labelKey: "DCS_DB_RECONFIGURE", onPick: () => onReconfigure(target) } : null,
  ];

  return {
    open_board_menu,
    open_widget_menu,
    add_canvas,
    menu_element: <BoardContextMenu at={menu} items={items} onClose={close} />,
  };
}
