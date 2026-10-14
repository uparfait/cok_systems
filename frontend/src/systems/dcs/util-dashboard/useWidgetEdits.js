import { useState } from "react";
import { save_dashboard, request_error_text } from "./dashboardService.js";
import { fold_family } from "./chartCatalog.js";
import { move_widget as reorder, hidden_by_filters } from "./boardOrder.js";

/**
 * The two edits a board makes to ONE widget at a time - changing it and
 * removing it - and the saving they both do.
 *
 * Both follow the same shape: work out the new widget list, save it, take
 * what came back as the truth, and tell the data layer. Only a change that
 * moves a widget into a different FOLDING FAMILY (a donut, which folds its
 * tail into "Other", becoming a bar, which does not) needs that one card's
 * data again; everything else - a title, a color, a size, a box - is a
 * change of looks and the data it already has still stands.
 *
 * Kept out of the page itself so the page is about what is on screen.
 */
export function useWidgetEdits({ form, widgets, layout, data, translate, showSuccess, showError, showInfo, onCommit }) {
  const [saving_widget_id, setSavingWidgetId] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [adding, setAdding] = useState(false);

  // The board's arrangement rides along only when the edit changed it.
  const save = async (next_widgets, next_layout) => {
    const saved = await save_dashboard(form, next_widgets, undefined, next_layout);
    const final_widgets = (saved.data && saved.data.widgets) || next_widgets;
    const final_layout = next_layout ? (saved.data && saved.data.layout) || next_layout : undefined;
    data.settle(final_widgets);
    onCommit(final_widgets, undefined, final_layout);
    return { final_widgets, message: saved && saved.message ? saved.message : "" };
  };

  /**
   * Moves one widget to a numbered place among the widgets DRAWN beside it
   * (the board's top level, or the section it sits in; cards the filters
   * hide are not counted), the others shifting to make room and children
   * following their parent. The first move freezes the shown order into
   * the array and marks the board ORDERED, so from then on the array is
   * the order. The board takes the new order at once and the save follows;
   * a refused save puts the previous order back.
   */
  const move_widget = async (target, position) => {
    if (!target) return { ok: false, message: "" };
    const hidden = (widget) => hidden_by_filters((data.data_by_widget || {})[widget.id]);
    const before = { widgets, layout: layout || null };
    const next_widgets = reorder(widgets, layout, target.id, position, hidden);
    const next_layout = Object.assign({}, layout || {}, { ordered: true });
    data.settle(next_widgets);
    onCommit(next_widgets, undefined, next_layout);
    setSavingWidgetId(target.id);
    try {
      const saved = await save_dashboard(form, next_widgets, undefined, next_layout);
      const final_widgets = (saved.data && saved.data.widgets) || next_widgets;
      const final_layout = Object.assign({}, next_layout, (saved.data && saved.data.layout) || {}, { ordered: true });
      data.settle(final_widgets);
      onCommit(final_widgets, undefined, final_layout);
      showSuccess(translate("DCS_DB_WIDGET_UPDATED"));
      return { ok: true, message: "" };
    } catch (error) {
      data.settle(before.widgets);
      onCommit(before.widgets, undefined, before.layout);
      const text = request_error_text(error, translate("DCS_ERROR_GENERIC"));
      showError(text);
      return { ok: false, message: text };
    } finally {
      setSavingWidgetId(null);
    }
  };

  const update_widget = async (widget_id, changes) => {
    const previous = widgets.find((widget) => widget.id === widget_id);
    const next_widgets = widgets.map((widget) => (widget.id === widget_id ? { ...widget, ...changes } : widget));
    setSavingWidgetId(widget_id);
    try {
      const { final_widgets, message } = await save(next_widgets);
      // A new folding family, a new window, other board filters to follow
      // or a table set up differently all change the numbers: that one
      // card is fetched again. Everything else is a change of looks.
      const redraws = changes.chart_type && previous && fold_family(changes.chart_type) !== fold_family(previous.chart_type);
      const rereads = ["period", "pinned_fields", "table", "filters"].some((key) => changes[key] !== undefined);
      if (redraws || rereads) {
        const updated = final_widgets.find((widget) => widget.id === widget_id);
        if (updated) data.retry_widget(updated);
      }
      showSuccess(translate("DCS_DB_WIDGET_UPDATED"));
      // What the server said, for whoever asked to show it where they are.
      return { ok: true, message: message || translate("DCS_DB_WIDGET_UPDATED") };
    } catch (error) {
      const text = request_error_text(error, translate("DCS_ERROR_GENERIC"));
      showError(text);
      return { ok: false, message: text };
    } finally {
      setSavingWidgetId(null);
    }
  };

  /**
   * Adds one widget - a new empty section, from the board's own menu - and
   * saves the board with it. It is said while it happens and answered in
   * the server's words when it lands; the data of everything already on
   * the board is settled, so nothing else is fetched again over it.
   */
  const add_widget = async (made) => {
    if (!made || adding) return { ok: false, message: "" };
    const next_widgets = widgets.concat([made]).map((widget, index) => ({ ...widget, position: index }));
    setAdding(true);
    if (showInfo) showInfo(translate("DCS_DB_CANVAS_ADDING"), 2500);
    try {
      const { message } = await save(next_widgets);
      const said = message || translate("DCS_DB_CANVAS_ADDED");
      showSuccess(said);
      return { ok: true, message: said };
    } catch (error) {
      const text = request_error_text(error, translate("DCS_ERROR_GENERIC"));
      showError(text);
      return { ok: false, message: text };
    } finally {
      setAdding(false);
    }
  };

  /**
   * Removing a widget takes whatever was INSIDE it with it: a canvas that
   * is gone cannot hold anything, and children left behind would name a
   * parent that no longer exists.
   */
  const remove_widget = async (target, onDone) => {
    if (!target) return;
    const doomed = new Set([target.id]);
    let grew = true;
    while (grew) {
      grew = false;
      widgets.forEach((widget) => {
        if (widget.parent_id && doomed.has(widget.parent_id) && !doomed.has(widget.id)) {
          doomed.add(widget.id);
          grew = true;
        }
      });
    }
    const next_widgets = widgets.filter((widget) => !doomed.has(widget.id)).map((widget, index) => ({ ...widget, position: index }));
    setRemoving(true);
    try {
      const { final_widgets } = await save(next_widgets);
      data.keep_only(final_widgets);
      showSuccess(translate("DCS_DB_WIDGET_REMOVED"));
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    } finally {
      setRemoving(false);
      if (onDone) onDone();
    }
  };

  return { saving_widget_id, removing, adding, update_widget, remove_widget, add_widget, move_widget };
}
