import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";

const PRIMARY = "#056daa";

/**
 * The choice shown before a dashboard is regenerated: "generate and update"
 * adds only the widgets that do not chart anything yet (everything already
 * on the board is skipped and kept untouched), while "overwrite" replaces
 * the whole basic dashboard with a fresh generation. Either way the result
 * opens in the review list first - no widget loads data until the review is
 * finished or canceled.
 */
export default function RegenerateDialog({ onPick, onCancel }) {
  const { translate } = useDcsLanguage();
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white border-2 w-full p-6" style={{ maxWidth: 460, borderColor: PRIMARY }}>
        <p className="text-base font-semibold mb-1" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
          {translate("DCS_DB_REGEN_TITLE")}
        </p>
        <p className="text-xs mb-5" style={{ color: "#9E9E9E" }}>
          {translate("DCS_DB_REGEN_HINT")}
        </p>

        <div className="mb-4">
          <DcsButtonPrimary className="w-full" onClick={() => onPick("update")}>
            {translate("DCS_DB_REGEN_UPDATE")}
          </DcsButtonPrimary>
          <p className="text-xs mt-1" style={{ color: "#9E9E9E" }}>
            {translate("DCS_DB_REGEN_UPDATE_HINT")}
          </p>
        </div>

        <div className="mb-5">
          <DcsButtonOutline className="w-full" variant="danger" onClick={() => onPick("overwrite")}>
            {translate("DCS_DB_REGEN_OVERWRITE")}
          </DcsButtonOutline>
          <p className="text-xs mt-1" style={{ color: "#9E9E9E" }}>
            {translate("DCS_DB_REGEN_OVERWRITE_HINT")}
          </p>
        </div>

        <DcsButtonOutline className="w-full" onClick={onCancel}>
          {translate("DCS_DB_REVIEW_CANCEL_ROW")}
        </DcsButtonOutline>
      </div>
    </div>
  );
}
