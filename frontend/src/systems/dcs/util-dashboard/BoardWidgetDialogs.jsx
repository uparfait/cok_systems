import React from "react";
import AppearanceDialog from "./builder/AppearanceDialog.jsx";
import { appearance_values_field } from "./builder/composeWidgets.js";
import IconPickerPanel from "./icons/IconPickerPanel.jsx";
import SkippedDetailsModal from "./SkippedDetailsModal.jsx";

/**
 * The per-widget dialogs of the dashboard page - color settings, the icon
 * picker and the skipped-answers detail - each shown for the widget the
 * page currently holds in the matching state slot.
 */
// A KPI card's icon is its own; a map's is the marker it plants on every
// place, which lives with the rest of its map settings.
const is_map = (widget) => !!widget && widget.chart_type === "map";
const icon_of = (widget) => (is_map(widget) ? { ...widget, icon: (widget.map && widget.map.marker) || null } : widget);
// Picking one for a map also plants it; removing it takes the markers off.
const icon_change = (widget, name) => (is_map(widget) ? { map: Object.assign({}, widget.map, { marker: name, show_markers: !!name }) } : { icon: name });

export default function BoardWidgetDialogs({ form, fields, widgets, savingWidgetId, appearanceWidget, iconWidget, skippedWidget, period, appliedFilters, onUpdate, onCloseAppearance, onCloseIcon, onCloseSkipped }) {
  const current_widget = () => (iconWidget ? widgets.find((widget) => widget.id === iconWidget.id) || iconWidget : null);

  return (
    <>
      {appearanceWidget && (
        <AppearanceDialog
          form={form}
          title={appearanceWidget.title}
          valuesField={appearance_values_field(appearanceWidget, fields)}
          appearance={appearanceWidget.appearance}
          onClose={onCloseAppearance}
          onApply={async (appearance) => {
            onCloseAppearance();
            await onUpdate(appearanceWidget.id, { appearance });
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
    </>
  );
}
