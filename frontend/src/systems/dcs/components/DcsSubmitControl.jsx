import React, { useEffect } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const SUCCESS_COLOR = "#4CAF50";
const SUCCESS_REVERT_MS = 5000;

/**
 * The submit button and its error messaging, shared identically by the
 * public form and the builder's review preview - both must look and
 * behave exactly the same. On success the button itself turns green and
 * reads "Data recorded" instead of a separate banner; it reverts to its
 * normal state automatically after 5 seconds (or immediately once the
 * respondent starts a new answer, via the parent resetting submitState).
 * On failure, an error banner points back at the highlighted fields.
 */
export default function DcsSubmitControl({ submitting, submitState, onSubmit, onIdle }) {
  const { translate } = useDcsLanguage();

  useEffect(() => {
    if (submitState !== "success" || !onIdle) return undefined;
    const timer = setTimeout(onIdle, SUCCESS_REVERT_MS);
    return () => clearTimeout(timer);
  }, [submitState, onIdle]);

  return (
    <>
      <div className="w-full mt-4 dcs-no-print">
        {submitting ? (
          <SpiralLoader />
        ) : (
          <DcsButtonPrimary
            className="w-full"
            onClick={onSubmit}
            disabled={submitting}
            style={submitState === "success" ? { backgroundColor: SUCCESS_COLOR, borderColor: SUCCESS_COLOR } : undefined}
          >
            {submitState === "success" ? translate("DCS_PUBLIC_DATA_RECORDED") : translate("DCS_RENDERER_SUBMIT")}
          </DcsButtonPrimary>
        )}
      </div>

      {submitState === "error" && (
        <div className="w-full mt-3 dcs-no-print">
          <p className="text-xs px-3 py-2" style={{ backgroundColor: "rgba(231,76,60,0.1)", color: "#E74C3C" }}>
            {translate("DCS_PUBLIC_FIX_ERRORS")}
          </p>
        </div>
      )}
    </>
  );
}
