import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "../../../../core/contexts/ToastContext.tsx";
import { save_dashboard, request_error_text } from "../dashboardService.js";
import { finalize_widgets } from "../builder/composeWidgets.js";
import DcsConfirmDialog from "../../components/DcsConfirmDialog.jsx";
import BoardGrid from "../BoardGrid.jsx";
import SelectionToolbar from "./SelectionToolbar.jsx";
import BulkEditDialog from "./BulkEditDialog.jsx";
import { useBoardSelection } from "./useBoardSelection.js";
import { portal_root } from "../portalRoot.js";

const PRIMARY = "#056daa";
const HEADING_FONT = { fontFamily: "'Montserrat', sans-serif" };

/** The small menu a right-click on the board opens: one entry, enable or disable the selection mode. */
function BoardContextMenu({ x, y, active, onToggle, onClose }) {
  const { translate } = useDcsLanguage();
  useEffect(() => {
    const close = () => onClose();
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [onClose]);
  const left = Math.min(x, window.innerWidth - 240);
  const top = Math.min(y, window.innerHeight - 60);
  return createPortal(
    <div className="dcs-builder-popover fixed bg-white border-2" role="menu" style={{ left, top, zIndex: 10040, borderColor: PRIMARY, minWidth: 220, boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }} onMouseDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        role="menuitem"
        className="dcs-db-menu-item block w-full text-left px-3 py-2 text-xs font-semibold cursor-pointer"
        style={{ color: active ? "#E74C3C" : PRIMARY, background: "none", border: "none", ...HEADING_FONT }}
        onClick={onToggle}
      >
        {translate(active ? "DCS_DB_SEL_DISABLE" : "DCS_DB_SEL_ENABLE")}
      </button>
    </div>,
    portal_root(),
  );
}

/**
 * The board grid plus its selection mode. A right-click anywhere on the
 * board offers to enable the mode (or disable it - after asking when
 * changes are unsaved). While it is on, the grid shows the working copy
 * (reordered by drag, edited or pruned in bulk) and the toolbar floats at
 * the bottom; nothing is saved until the user asks, then the whole list
 * is stored in one save.
 */
export default function BoardWithSelection({ form, fields, widgets, editable, onSaved, onSelectionChange, ...grid_props }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [menu, setMenu] = useState(null);
  const [confirm_exit, setConfirmExit] = useState(false);
  const [confirm_delete, setConfirmDelete] = useState(false);
  // The page follows the mode: filters, for one, only reorder while it is on.
  useEffect(() => {
    if (onSelectionChange) onSelectionChange(selection.active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.active]);
  const [bulk_open, setBulkOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const selection = useBoardSelection(widgets);
  const shown = selection.active ? selection.working : widgets;

  const request_exit = () => {
    if (selection.dirty) setConfirmExit(true);
    else selection.exit();
  };

  const handle_context_menu = (event) => {
    if (!editable) return;
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY });
  };

  const handle_save = async () => {
    setSaving(true);
    try {
      const positioned = finalize_widgets(selection.working);
      const saved = await save_dashboard(form, positioned);
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
    <div onContextMenu={handle_context_menu}>
      <BoardGrid
        {...grid_props}
        widgets={shown}
        editable={editable && !selection.active}
        selection={selection.active ? { selected: selection.selected, onToggle: selection.toggle, onMove: selection.move } : null}
      />
      {menu && (
        <BoardContextMenu
          x={menu.x}
          y={menu.y}
          active={selection.active}
          onClose={() => setMenu(null)}
          onToggle={() => {
            setMenu(null);
            if (selection.active) request_exit();
            else selection.enter();
          }}
        />
      )}
      {selection.active && (
        <SelectionToolbar selection={selection} saving={saving} onEdit={() => setBulkOpen(true)} onDelete={() => setConfirmDelete(true)} onSave={handle_save} onExit={request_exit} />
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
    </div>
  );
}
