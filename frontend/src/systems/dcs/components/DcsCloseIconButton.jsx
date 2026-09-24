import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

/**
 * The way out of an overlay: a round X on the coloured title bar, the
 * same on every overlay of the module so it is always found in the same
 * place. Icon only; the label is on the tooltip and for screen readers.
 */
export default function DcsCloseIconButton({ onClick, disabled }) {
  const { translate } = useDcsLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={translate("DCS_BTN_CLOSE")}
      title={translate("DCS_BTN_CLOSE")}
      className="dcs-viewer-close flex items-center justify-center flex-shrink-0 cursor-pointer"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
        <line x1="5" y1="5" x2="19" y2="19" />
        <line x1="19" y1="5" x2="5" y2="19" />
      </svg>
    </button>
  );
}
