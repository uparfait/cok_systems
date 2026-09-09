import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const PRIMARY = "#056daa";

/**
 * The progress readout shown while a form's dashboard is being generated:
 * a moving bar plus the current stage message (analyzing fields, building
 * charts, saving). Purely presentational - the generator drives it through
 * percent / messageKey.
 */
export default function GenerationProgress({ percent, messageKey }) {
  const { translate } = useDcsLanguage();
  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-semibold" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
          {translate(messageKey || "DCS_DB_GEN_PROGRESS_ANALYZE")}
        </span>
        <span className="text-xs font-semibold" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>
          {Math.round(percent)}%
        </span>
      </div>
      <div className="w-full" style={{ height: 8, backgroundColor: "#E9EEF2" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.max(2, Math.min(100, percent))}%`,
            backgroundColor: PRIMARY,
            transition: "width 320ms ease",
          }}
        />
      </div>
    </div>
  );
}
