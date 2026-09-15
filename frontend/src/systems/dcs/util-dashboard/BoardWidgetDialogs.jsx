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
export default function BoardWidgetDialogs({ form, fields, widgets, savingWidgetId, appearanceWidget, iconWidget, skippedWidget, period, onUpdate, onCloseAppearance, onCloseIcon, onCloseSkipped }) {
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
          widget={widgets.find((widget) => widget.id === iconWidget.id) || iconWidget}
          saving={savingWidgetId === iconWidget.id}
          onPick={async (name) => {
            await onUpdate(iconWidget.id, { icon: name });
            onCloseIcon();
          }}
          onRemove={async () => {
            await onUpdate(iconWidget.id, { icon: null });
            onCloseIcon();
          }}
          onClose={onCloseIcon}
        />
      )}
      {skippedWidget && <SkippedDetailsModal form={form} widget={skippedWidget} period={period} onClose={onCloseSkipped} />}
    </>
  );
}
