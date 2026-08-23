import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

/**
 * The flying icon that toggles between an overview page and its "usual"
 * settings/tabs panel - shared by the project and form detail pages, both
 * of which swap the panel in as a full replacement (not an overlay) when
 * this is clicked. A settings glyph morphs into a close (X) via a
 * cross-fade + rotate between two stacked icon layers, rather than
 * swapping DOM nodes.
 */
export default function DcsPanelToggleButton({ isOpen, isBusy, onClick, openTitleKey, closeTitleKey }) {
  const { translate } = useDcsLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isBusy}
      title={translate(isOpen ? closeTitleKey : openTitleKey)}
      className="dcs-project-fab bg-white border"
      style={{ opacity: isBusy ? 0.5 : 1, cursor: isBusy ? "not-allowed" : "pointer" }}
    >
      <span
        className="dcs-project-fab-icon"
        style={{ opacity: isOpen ? 0 : 1, transform: isOpen ? "rotate(90deg) scale(0.6)" : "rotate(0deg) scale(1)" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2.2" strokeLinecap="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <circle cx="15" cy="7" r="2" fill="#056daa" stroke="none" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <circle cx="9" cy="12" r="2" fill="#056daa" stroke="none" />
          <line x1="4" y1="17" x2="20" y2="17" />
          <circle cx="17" cy="17" r="2" fill="#056daa" stroke="none" />
        </svg>
      </span>
      <span
        className="dcs-project-fab-icon"
        style={{ opacity: isOpen ? 1 : 0, transform: isOpen ? "rotate(0deg) scale(1)" : "rotate(-90deg) scale(0.6)" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2.4" strokeLinecap="round">
          <line x1="5" y1="5" x2="19" y2="19" />
          <line x1="19" y1="5" x2="5" y2="19" />
        </svg>
      </span>
    </button>
  );
}
