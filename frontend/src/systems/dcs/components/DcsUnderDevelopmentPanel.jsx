import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

/**
 * Disabled placeholder panel for a section that is shown but not yet
 * built, with a translated hover explanation.
 */
export default function DcsUnderDevelopmentPanel({ titleKey }) {
  const { translate } = useDcsLanguage();
  return (
    <div
      className="bg-white border-2 p-4 sm:p-6 opacity-50 cursor-not-allowed"
      style={{ borderColor: "#E0E0E0" }}
      title={translate("DCS_UNDER_DEVELOPMENT")}
    >
      <h3 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 16, color: "#333333" }}>
        {translate(titleKey)}
      </h3>
    </div>
  );
}
