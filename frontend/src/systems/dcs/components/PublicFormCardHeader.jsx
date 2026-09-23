import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const FONT = "'Montserrat', sans-serif";

/**
 * The line above the public form's fields: who is filling it in (from the
 * respondent gate) and the circular print button at the right.
 */
export default function PublicFormCardHeader({ respondent, disabled }) {
  const { translate } = useDcsLanguage();
  return (
    <div className="flex items-center justify-between gap-2 mb-3 dcs-no-print">
      <p className="text-xs truncate" style={{ color: "#9E9E9E", fontFamily: FONT }}>
        {respondent ? translate("DCS_RESPONDENT_FILLING_AS", { name: String(respondent.name || "").trim().split(" ")[0] }) : ""}
      </p>
      <button
        type="button"
        onClick={() => window.print()}
        disabled={disabled}
        title={translate("DCS_BTN_PRINT")}
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #056daa", opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2">
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
      </button>
    </div>
  );
}
