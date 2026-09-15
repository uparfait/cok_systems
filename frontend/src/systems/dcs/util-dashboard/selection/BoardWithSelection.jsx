import React, { useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "../../../../core/contexts/ToastContext.tsx";
import { save_dashboard, request_error_text } from "../dashboardService.js";
import { finalize_widgets } from "../builder/composeWidgets.js";
import DcsConfirmDialog from "../../components/DcsConfirmDialog.jsx";
import BoardGrid from "../BoardGrid.jsx";
import SelectionToolbar from "./SelectionToolbar.jsx";
import BulkEditDialog from "./BulkEditDialog.jsx";
import { useBoardSelection, SHORTCUT_LABEL } from "./useBoardSelection.js";

/**
 * The board grid plus its selection mode. While the mode is off this is
 * the plain grid with a discreet shortcut tip for editors; while it is on,
 * the grid shows the working copy (reordered by drag, edited or pruned in
 * bulk), the toolbar floats at the bottom and nothing is saved until the
 * user asks - then the whole reordered list is stored in one save.
 */
export default function BoardWithSelection({ form, fields, widgets, editable, onSaved, ...grid_props }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [confirm_exit, setConfirmExit] = useState(false);
  const [confirm_delete, setConfirmDelete] = useState(false);
  const [bulk_open, setBulkOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const selection = useBoardSelection(widgets, { enabled: editable, onRequestExit: () => setConfirmExit(true) });
  const shown = selection.active ? selection.working : widgets;

  const handle_save = async () => {
    setSaving(true);
    try {
      const positioned = finalize_widgets(selection.working);
      const saved = await save_dashboard(form.form_group_id, positioned);
      const final_widgets = (saved.data && saved.data.widgets) || positioned;
      showSuccess(translate("DCS_DB_SEL_SAVED"));
      selection.exit();
      onSaved(final_widgets);
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {editable && !selection.active && widgets.length > 1 && (
        <p className="text-[11px] mb-2 text-right" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
          {translate("DCS_DB_SEL_SHORTCUT_TIP", { shortcut: SHORTCUT_LABEL })}
        </p>
      )}
      <BoardGrid
        {...grid_props}
        widgets={shown}
        editable={editable && !selection.active}
        selection={selection.active ? { selected: selection.selected, onToggle: selection.toggle, onMove: selection.move } : null}
      />
      {selection.active && (
        <SelectionToolbar selection={selection} saving={saving} onEdit={() => setBulkOpen(true)} onDelete={() => setConfirmDelete(true)} onSave={handle_save} />
      )}
      {bulk_open && (
        <BulkEditDialog
          form={form}
          fields={fields}
          widgets={selection.selected_widgets}
          onClose={() => setBulkOpen(false)}
          onApply={(patches) => {
            selection.apply_patches(patches);
            setBulkOpen(false);
            showSuccess(translate("DCS_DB_BULK_APPLIED", { count: Object.keys(patches).length }));
          }}
        />
      )}
      {confirm_delete && (
        <DcsConfirmDialog
          titleKey="DCS_DB_SEL_DELETE_TITLE"
          messageKey="DCS_DB_SEL_DELETE_MESSAGE"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            selection.remove_selected();
            setConfirmDelete(false);
          }}
        />
      )}
      {confirm_exit && (
        <DcsConfirmDialog
          titleKey="DCS_DB_SEL_DISCARD_TITLE"
          messageKey="DCS_DB_SEL_DISCARD_MESSAGE"
          onCancel={() => setConfirmExit(false)}
          onConfirm={() => {
            setConfirmExit(false);
            selection.exit();
          }}
        />
      )}
    </>
  );
}
