import React from "react";
import AppearanceDialog from "./builder/AppearanceDialog.jsx";
import { appearance_values_field } from "./builder/composeWidgets.js";
import IconPickerPanel from "./icons/IconPickerPanel.jsx";
import SkippedDetailsModal from "./SkippedDetailsModal.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";

/**
 * The dialogs of the dashboard page - color settings, the icon picker,
 * the skipped-answers detail, and the two confirmations that something is
 * about to be thrown away - each shown for whatever the page currently
 * holds in the matching state slot.
 */
// A KPI card's icon is its own; a map's is the marker it plants on every
// place, which lives with the rest of its map settings.
const is_map = (widget) => !!widget && widget.chart_type === "map";
const icon_of = (widget) => (is_map(widget) ? { ...widget, icon: (widget.map && widget.map.marker) || null } : widget);
// Picking one for a map also plants it; removing it takes the markers off.
const icon_change = (widget, name) => (is_map(widget) ? { map: Object.assign({}, widget.map, { marker: name, show_markers: !!name }) } : { icon: name });

export default function BoardWidgetDialogs({ form, fields, widgets, savingWidgetId, appearanceWidget, iconWidget, skippedWidget, period, appliedFilters, onUpdate, onCloseAppearance, onCloseIcon, onCloseSkipped, confirmDelete, confirmRemove }) {
  const current_widget = () => (iconWidget ? widgets.find((widget) => widget.id === iconWidget.id) || iconWidget : null);

  return (
    <>
      {appearanceWidget && (
        <AppearanceDialog
          form={form}
          title={appearanceWidget.title}
          description={appearanceWidget.description || ""}
          valuesField={appearance_values_field(appearanceWidget, fields)}
          appearance={appearanceWidget.appearance}
          box={appearanceWidget.parent_id ? appearanceWidget.box || { flow: "row" } : null}
          // A canvas is a section: it draws no data, so the dialog leaves
          // out everything about numbers, units and legends.
          dataless={appearanceWidget.chart_type === "canvas"}
          canvas={appearanceWidget.chart_type === "canvas" ? appearanceWidget.canvas || { flow: "row", gap: 12, height: null } : null}
          onClose={onCloseAppearance}
          onApply={async (result) => {
            // The name and the description are set in this dialog too, so
            // one apply carries everything about the widget it describes.
            const changes = { appearance: result.appearance, title: result.title, description: result.description };
            // A widget on the board itself has no box: the grid places it.
            if (appearanceWidget.parent_id) changes.box = result.box;
            if (result.canvas) changes.canvas = result.canvas;
            // The dialog shows the save happening and what came back, and
            // closes itself once that has been read.
            return onUpdate(appearanceWidget.id, changes);
          }}
        />
      )}
      {iconWidget && (
        <IconPickerPanel
          widget={icon_of(widgets.find((widget) => widget.id === iconWidget.id) || iconWidget)}
          saving={savingWidgetId === iconWidget.id}
          onPick={async (name) => {
            await onUpdate(iconWidget.id, icon_change(current_widget(), name));
            onCloseIcon();
          }}
          onRemove={async () => {
            await onUpdate(iconWidget.id, icon_change(current_widget(), null));
            onCloseIcon();
          }}
          onClose={onCloseIcon}
        />
      )}
      {skippedWidget && <SkippedDetailsModal form={form} widget={skippedWidget} period={period} filters={appliedFilters} onClose={onCloseSkipped} />}
      {confirmDelete && confirmDelete.open && (
        <DcsConfirmDialog titleKey="DCS_DB_DEL_CONFIRM_TITLE" messageKey="DCS_DB_DEL_CONFIRM_MESSAGE" confirming={confirmDelete.busy} onConfirm={confirmDelete.onConfirm} onCancel={confirmDelete.onCancel} />
      )}
      {confirmRemove && confirmRemove.open && (
        <DcsConfirmDialog titleKey="DCS_DB_REMOVE_TITLE" messageKey="DCS_DB_REMOVE_MESSAGE" confirming={confirmRemove.busy} onConfirm={confirmRemove.onConfirm} onCancel={confirmRemove.onCancel} />
      )}
    </>
  );
}
