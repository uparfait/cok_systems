import React, { useState, useEffect, useRef } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsLanguageSwitcher from "./DcsLanguageSwitcher.jsx";

const PRIMARY = "#056daa";
const GRAY = "#9E9E9E";
const BORDER = "#E0E0E0";
const fontHeading = "'Montserrat', sans-serif";

export default function DcsApprovalSettingsButton({ view, onViewChange, formOptions, activeFormKey, onFormChange, busy }) {
  const { translate } = useDcsLanguage();
  const [open, setOpen] = useState(false);
  const holder_ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const on_outside = (event) => {
      if (holder_ref.current && !holder_ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", on_outside);
    return () => document.removeEventListener("mousedown", on_outside);
  }, [open]);

  return (
    <div className="dcs-approval-settings" ref={holder_ref}>
      {open && (
        <div className="dcs-approval-settings-panel" style={{ borderColor: BORDER }}>
          <p className="text-xs font-bold uppercase mb-2" style={{ color: GRAY, fontFamily: fontHeading, letterSpacing: 0.5 }}>
            {translate("DCS_MYAPPROVALS_VIEW_LABEL")}
          </p>
          <div className="flex flex-col border-2 mb-4 w-full" style={{ borderColor: "rgba(5,109,170,0.35)" }}>
            {["table", "form"].map((mode) => {
              const label = translate(mode === "table" ? "DCS_MYAPPROVALS_TABLE_VIEW" : "DCS_MYAPPROVALS_FORM_VIEW");
              const active = view === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onViewChange(mode)}
                  className="w-full cursor-pointer text-xs font-bold uppercase px-3 py-2.5 text-left truncate"
                  style={{
                    fontFamily: fontHeading,
                    letterSpacing: 0.5,
                    backgroundColor: active ? PRIMARY : "transparent",
                    color: active ? "#FFFFFF" : GRAY,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {formOptions.length > 1 && (
            <>
              <p className="text-xs font-bold uppercase mb-2" style={{ color: GRAY, fontFamily: fontHeading, letterSpacing: 0.5 }}>
                {translate("DCS_MYAPPROVALS_FORM_LABEL")}
              </p>
              <select
                value={activeFormKey || ""}
                onChange={(event) => onFormChange(event.target.value)}
                disabled={busy}
                className="cok-auth-input w-full pr-3 py-2 text-sm cursor-pointer mb-4"
                style={{ backgroundColor: "#FFFFFF" }}
              >
                {formOptions.map((option) => (
                  <option key={option.form_key} value={option.form_key}>
                    {option.form_name} ({option.count})
                  </option>
                ))}
              </select>
            </>
          )}

          <p className="text-xs font-bold uppercase mb-2" style={{ color: GRAY, fontFamily: fontHeading, letterSpacing: 0.5 }}>
            {translate("DCS_LANGUAGE_LABEL")}
          </p>
          <DcsLanguageSwitcher className="w-full" />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={translate(open ? "DCS_BTN_CLOSE" : "DCS_MYAPPROVALS_SETTINGS")}
        aria-label={translate(open ? "DCS_BTN_CLOSE" : "DCS_MYAPPROVALS_SETTINGS")}
        aria-expanded={open}
        className={`dcs-approval-settings-button ${open ? "is-open" : "is-ticking"}`}
        style={{ backgroundColor: PRIMARY }}
      >
        {open ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 110-4h.09A1.65 1.65 0 004.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 3.68 1.65 1.65 0 0010 2.17V2a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V8a1.65 1.65 0 001.51 1H22a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        )}
      </button>
    </div>
  );
}
