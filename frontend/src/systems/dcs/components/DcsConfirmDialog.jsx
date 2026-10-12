import React from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { portal_root } from "../util-dashboard/portalRoot.js";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsOverlayHeader from "./DcsOverlayHeader.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const DANGER = "#E74C3C";
const ABOVE_EVERYTHING = 10070;

export default function DcsConfirmDialog({ titleKey, messageKey, onConfirm, onCancel, confirming }) {
  const { translate } = useDcsLanguage();

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: ABOVE_EVERYTHING }}>
      <div className="absolute inset-0 bg-black/40" onClick={confirming ? undefined : onCancel} />
      <div
        className="relative bg-white border border-gray-200 w-full flex flex-col shadow-xl"
        style={{ maxWidth: 420, borderLeft: `3px solid ${DANGER}` }}
        role="dialog"
        aria-modal="true"
        aria-busy={!!confirming}
      >
        <DcsOverlayHeader title={translate(titleKey)} onClose={onCancel} busy={confirming} />
        <div className="px-4 min-[480px]:px-5 py-4">
          <p className="text-sm" style={{ color: "#555555" }}>
            {translate(messageKey)}
          </p>
        </div>
        <div className="px-4 min-[480px]:px-5 pb-4">
          {confirming ? (
            <SpiralLoader />
          ) : (
            <DcsButtonPrimary className="w-full" onClick={onConfirm}>
              {translate("DCS_YES")}
            </DcsButtonPrimary>
          )}
        </div>
      </div>
    </div>,
    portal_root(),
  );
}
