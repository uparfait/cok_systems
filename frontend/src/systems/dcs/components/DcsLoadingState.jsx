import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

/**
 * Centered loading indicator reused across every DCS page - the only
 * loading indicator allowed anywhere in the DCS system.
 */
export default function DcsLoadingState({ messageKey }) {
  const { translate } = useDcsLanguage();
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <SpiralLoader />
      <p className="text-sm" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
        {translate(messageKey || "DCS_LOADING")}
      </p>
    </div>
  );
}
