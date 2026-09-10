import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

export default function DcsDetailsToggleButton({ isOpen, onClick, small }) {
  const { translate } = useDcsLanguage();
  const stroke = isOpen ? "#FFFFFF" : "#056daa";

  return (
    <button
      type="button"
      onClick={onClick}
      title={translate(isOpen ? "DCS_MYAPPROVALS_PANEL_HIDE" : "DCS_MYAPPROVALS_PANEL_SHOW")}
      aria-label={translate(isOpen ? "DCS_MYAPPROVALS_PANEL_HIDE" : "DCS_MYAPPROVALS_PANEL_SHOW")}
      aria-expanded={isOpen}
      className={`dcs-details-toggle ${isOpen ? "is-open" : ""} ${small ? "is-small" : ""}`}
    >
      <span
        className="dcs-details-toggle-icon"
        style={{ opacity: isOpen ? 0 : 1, transform: isOpen ? "rotate(-90deg) scale(0.6)" : "rotate(0deg) scale(1)" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="8" r="3.6" />
          <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
        </svg>
      </span>
      <span
        className="dcs-details-toggle-icon"
        style={{ opacity: isOpen ? 1 : 0, transform: isOpen ? "rotate(0deg) scale(1)" : "rotate(90deg) scale(0.6)" }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="10" y1="12" x2="20" y2="12" />
          <line x1="15" y1="17" x2="20" y2="17" />
        </svg>
      </span>
    </button>
  );
}
