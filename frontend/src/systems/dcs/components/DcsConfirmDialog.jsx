import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const DANGER = "#E74C3C";

/**
 * Generic confirm-or-cancel dialog for a destructive action, used wherever
 * the DCS system needs an explicit "are you sure" before proceeding.
 */
export default function DcsConfirmDialog({ titleKey, messageKey, onConfirm, onCancel, confirming }) {
  const { translate } = useDcsLanguage();

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={confirming ? undefined : onCancel} />
      <div className="relative bg-white border-2 w-full p-6" style={{ maxWidth: 420, borderColor: DANGER }}>
        <p className="text-base font-semibold mb-2" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
          {translate(titleKey)}
        </p>
        <p className="text-sm mb-6" style={{ color: "#555555" }}>
          {translate(messageKey)}
        </p>

        {confirming ? (
          <SpiralLoader />
        ) : (
          <div className="flex gap-3">
            <DcsButtonOutline className="flex-1" variant="danger" onClick={onCancel}>
              {translate("DCS_NO")}
            </DcsButtonOutline>
            <DcsButtonPrimary className="flex-1" onClick={onConfirm}>
              {translate("DCS_YES")}
            </DcsButtonPrimary>
          </div>
        )}
      </div>
    </div>
  );
}
