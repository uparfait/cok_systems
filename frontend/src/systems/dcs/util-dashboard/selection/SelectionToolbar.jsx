import React from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsButtonPrimary from "../../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import DcsButtonOutlineDanger from "../../components/DcsButtonOutlineDanger.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";

const PRIMARY = "#056daa";
const HEADING_FONT = { fontFamily: "'Montserrat', sans-serif" };

/**
 * What the selection mode shows while it is on: a pulsing indicator at the
 * top and a floating bar at the bottom with the selection count, select-all
 * / clear, edit and delete for the selection, save for the pending changes
 * and exit (which asks first when changes are unsaved).
 */
export default function SelectionToolbar({ selection, saving, onEdit, onDelete, onSave, onExit }) {
  const { translate } = useDcsLanguage();
  const count = selection.selected.size;
  const total = selection.working.length;

  return createPortal(
    <>
      <div className="dcs-selection-indicator fixed left-1/2 top-3 z-[9990] flex items-center gap-2 px-3 py-1.5" style={{ transform: "translateX(-50%)", backgroundColor: PRIMARY, color: "#FFFFFF", boxShadow: "0 6px 18px rgba(0,0,0,0.18)" }}>
        <span className="dcs-selection-dot" />
        <span className="text-xs font-bold uppercase" style={{ letterSpacing: "0.5px", ...HEADING_FONT }}>
          {translate("DCS_DB_SEL_ON")}
        </span>
        <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.85)" }}>
          {translate("DCS_DB_SEL_HINT")}
        </span>
      </div>

      <div className="dcs-selection-bar fixed left-1/2 bottom-4 z-[9990] bg-white border-2 px-3 py-2 flex flex-wrap items-center justify-center gap-2" style={{ transform: "translateX(-50%)", borderColor: PRIMARY, boxShadow: "0 10px 30px rgba(0,0,0,0.2)", maxWidth: "calc(100vw - 24px)" }}>
        <span className="text-xs font-bold px-2 py-1" style={{ color: PRIMARY, backgroundColor: "#EAF3F8", ...HEADING_FONT }}>
          {translate("DCS_DB_SEL_COUNT", { count, total })}
        </span>
        {saving ? (
          <SpiralLoader padded={false} size={20} />
        ) : (
          <>
            <button type="button" className="text-xs font-semibold cursor-pointer px-2 py-1" style={{ color: PRIMARY, background: "none", border: `1px solid ${PRIMARY}`, ...HEADING_FONT }} onClick={count === total ? selection.clear : selection.select_all}>
              {translate(count === total && total > 0 ? "DCS_DB_SEL_NONE" : "DCS_DB_SEL_ALL")}
            </button>
            <DcsButtonOutline className="px-3 py-1.5" disabled={count === 0} onClick={onEdit} style={{ minHeight: 34 }}>
              {translate("DCS_DB_SEL_EDIT")}
            </DcsButtonOutline>
            <DcsButtonOutlineDanger className="px-3 py-1.5" disabled={count === 0} onClick={onDelete} style={{ minHeight: 34 }}>
              {translate("DCS_DB_SEL_DELETE")}
            </DcsButtonOutlineDanger>
            <DcsButtonPrimary className="px-3 py-1.5" disabled={!selection.dirty} onClick={onSave} style={{ minHeight: 34 }}>
              {translate("DCS_DB_SEL_SAVE")}
            </DcsButtonPrimary>
            <button type="button" className="text-xs font-semibold cursor-pointer px-2 py-1" style={{ color: "#555555", background: "none", border: "none", textDecoration: "underline", ...HEADING_FONT }} onClick={onExit}>
              {translate("DCS_DB_SEL_EXIT")}
            </button>
          </>
        )}
      </div>
    </>,
    document.body,
  );
}
