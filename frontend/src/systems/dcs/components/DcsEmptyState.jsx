import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

/**
 * Centered empty-state message reused across every DCS list view.
 */
export default function DcsEmptyState({ messageKey, children }) {
  const { translate } = useDcsLanguage();
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <p className="text-sm" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
        {translate(messageKey)}
      </p>
      {children}
    </div>
  );
}
