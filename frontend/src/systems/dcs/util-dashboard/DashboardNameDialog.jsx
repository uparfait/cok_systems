import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { IconButton, CLOSE_SVG } from "./BoardIcons.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import { portal_root } from "./portalRoot.js";

const PRIMARY = "#056daa";
const FONT = { fontFamily: "'Montserrat', sans-serif" };
const MAX_NAME = 80;

/**
 * Asks for a dashboard's name before it is created - a form's dashboard is
 * never named automatically. Shown the first time a form's dashboard page
 * opens with no dashboard yet, and from the switcher's "Add dashboard".
 * Cancel is offered whenever the page has something else to show.
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
      <form onSubmit={submit} className="dcs-builder-pop relative bg-white border-2 w-full flex flex-col" style={{ maxWidth: 480, borderColor: PRIMARY }}>
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-2" style={{ backgroundColor: PRIMARY }}>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase leading-tight truncate" style={{ color: "#FFFFFF", letterSpacing: "0.3px", ...FONT }}>
              {translate("DCS_DB_CREATE_TITLE")}
            </p>
            {formName && (
              <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)", ...FONT }}>
                {formName}
              </p>
            )}
          </div>
          {onCancel && (
            <IconButton title={translate("DCS_BTN_CLOSE")} onClick={onCancel} onDark danger disabled={saving}>
              {CLOSE_SVG}
            </IconButton>
          )}
        </div>
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
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <div className="w-full sm:w-52">
              <DcsButtonPrimary type="submit" disabled={saving}>
                {saving ? translate("DCS_DB_WORKING") : translate("DCS_DB_CREATE_BTN")}
              </DcsButtonPrimary>
            </div>
            {onCancel && (
              <div className="w-full sm:w-36">
                <DcsButtonOutline type="button" onClick={onCancel} disabled={saving}>
                  {translate("DCS_BTN_CANCEL")}
                </DcsButtonOutline>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>,
    portal_root(),
  );
}
