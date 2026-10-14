import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsOverlayHeader from "../components/DcsOverlayHeader.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import { portal_root } from "./portalRoot.js";

const BORDER = "#E0E0E0";
const MAX_NAME = 80;

/**
 * Asks for a dashboard's name before it is created - a form's dashboard is
 * never named automatically. Shown the first time a form's dashboard page
 * opens with no dashboard yet, and from the switcher's "Add dashboard".
 * The close control is offered whenever the page has something else to show.
 */
export default function DashboardNameDialog({ formName, saving, onSubmit, onCancel }) {
  const { translate } = useDcsLanguage();
  const [name, setName] = useState("");
  const [problem, setProblem] = useState("");

  useEffect(() => {
    if (!onCancel) return undefined;
    const on_key = (event) => {
      if (event.key === "Escape" && !saving) onCancel();
    };
    document.addEventListener("keydown", on_key);
    return () => document.removeEventListener("keydown", on_key);
  }, [onCancel, saving]);

  const submit = (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setProblem(translate("DCS_DB_NAME_REQUIRED"));
      return;
    }
    setProblem("");
    onSubmit(trimmed);
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/45" onClick={onCancel && !saving ? onCancel : undefined} />
      <form onSubmit={submit} className="dcs-builder-pop relative bg-white border-2 w-full flex flex-col" style={{ maxWidth: 480, borderColor: BORDER }}>
        <DcsOverlayHeader title={translate("DCS_DB_CREATE_TITLE")} subtitle={formName || null} onClose={onCancel || null} busy={saving} />
        <div className="p-4 sm:p-5 space-y-3">
          <p className="text-xs" style={{ color: "#9E9E9E" }}>
            {translate("DCS_DB_CREATE_INTRO")}
          </p>
          <div>
            <label className="cok-auth-label">{translate("DCS_DB_NAME_LABEL")}</label>
            <input className="cok-auth-input w-full py-2" value={name} maxLength={MAX_NAME} autoFocus disabled={saving} placeholder={translate("DCS_DB_NAME_PLACEHOLDER")} onChange={(event) => setName(event.target.value)} />
          </div>
          {problem && (
            <p className="text-xs font-semibold" style={{ color: "#E74C3C" }}>
              {problem}
            </p>
          )}
          <div className="pt-1">
            <div className="w-full sm:w-52">
              <DcsButtonPrimary type="submit" disabled={saving}>
                {saving ? translate("DCS_DB_WORKING") : translate("DCS_DB_CREATE_BTN")}
              </DcsButtonPrimary>
            </div>
          </div>
        </div>
      </form>
    </div>,
    portal_root(),
  );
}
