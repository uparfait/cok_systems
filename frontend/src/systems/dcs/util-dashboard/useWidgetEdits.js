import { useState } from "react";
import { save_dashboard, request_error_text } from "./dashboardService.js";
import { fold_family } from "./chartCatalog.js";

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
export function useWidgetEdits({ form, widgets, data, translate, showSuccess, showError, onCommit }) {
  const [saving_widget_id, setSavingWidgetId] = useState(null);
  const [removing, setRemoving] = useState(false);

  const save = async (next_widgets) => {
    const saved = await save_dashboard(form, next_widgets);
    const final_widgets = (saved.data && saved.data.widgets) || next_widgets;
    data.settle(final_widgets);
    onCommit(final_widgets);
    return { final_widgets, message: saved && saved.message ? saved.message : "" };
  };

  const update_widget = async (widget_id, changes) => {
    const previous = widgets.find((widget) => widget.id === widget_id);
    const next_widgets = widgets.map((widget) => (widget.id === widget_id ? { ...widget, ...changes } : widget));
    setSavingWidgetId(widget_id);
    try {
      const { final_widgets, message } = await save(next_widgets);
      if (changes.chart_type && previous && fold_family(changes.chart_type) !== fold_family(previous.chart_type)) {
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
      const final_widgets = await save(next_widgets);
      data.keep_only(final_widgets);
      showSuccess(translate("DCS_DB_WIDGET_REMOVED"));
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    } finally {
      setRemoving(false);
      if (onDone) onDone();
    }
  };

  return { saving_widget_id, removing, update_widget, remove_widget };
}
