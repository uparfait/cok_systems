import React, { useEffect } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsButtonPrimary from "../../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";

const PRIMARY = "#056daa";

/**
 * The widget wizard's frame: a full-screen overlay with the system blue
 * header (uppercase title, hoverable close), a step indicator, a scrolling
 * body and the Back / Next / Finish footer. Purely presentational - the
 * wizard itself owns every bit of state.
 */
export default function WizardShell({
  titleKey,
  steps,
  currentStep,
  onClose,
  onBack,
  onNext,
  nextDisabled,
  nextLabelKey,
  problems,
  children,
}) {
  const { translate } = useDcsLanguage();

  useEffect(() => {
    const handle_key = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handle_key);
    return () => document.removeEventListener("keydown", handle_key);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white w-full sm:max-w-3xl flex flex-col h-full sm:h-[90vh]" style={{ maxHeight: "100vh" }}>
        <div className="flex items-center justify-between gap-2 px-4 py-3 flex-shrink-0" style={{ backgroundColor: PRIMARY }}>
          <h2
            className="text-sm font-bold uppercase truncate"
            style={{ color: "rgba(255,255,255,0.92)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.8px" }}
          >
            {translate(titleKey)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={translate("DCS_BTN_CANCEL")}
            className="dcs-db-close flex items-center justify-center flex-shrink-0"
            style={{ width: 30, height: 30, color: "rgba(255,255,255,0.92)", fontSize: 20, lineHeight: 1, cursor: "pointer" }}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-1 px-4 py-2 flex-shrink-0" style={{ backgroundColor: "#F4F7F9", borderBottom: "1px solid #E0E0E0" }}>
          {steps.map((step, index) => (
            <span
              key={step}
              className="text-xs font-semibold uppercase px-2 py-1"
              style={{
                fontFamily: "'Montserrat', sans-serif",
                letterSpacing: "0.4px",
                color: index === currentStep ? "#FFFFFF" : index < currentStep ? PRIMARY : "#9E9E9E",
                backgroundColor: index === currentStep ? PRIMARY : "transparent",
                border: index === currentStep ? `1px solid ${PRIMARY}` : "1px solid transparent",
              }}
            >
              {index + 1}. {translate(step)}
            </span>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        <div className="flex-shrink-0 px-4 py-3" style={{ borderTop: "1px solid #E0E0E0" }}>
          {problems && problems.length > 0 && (
            <p className="text-xs mb-2" style={{ color: "#E74C3C" }}>
              {problems.map((key) => translate(key)).join(" - ")}
            </p>
          )}
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
            <div className="w-full sm:w-36">
              <DcsButtonOutline type="button" onClick={currentStep === 0 ? onClose : onBack}>
                {translate(currentStep === 0 ? "DCS_BTN_CANCEL" : "DCS_DB_BACK")}
              </DcsButtonOutline>
            </div>
            <div className="w-full sm:w-56">
              <DcsButtonPrimary type="button" onClick={onNext} disabled={nextDisabled}>
                {translate(nextLabelKey)}
              </DcsButtonPrimary>
            </div>
          </div>
        </div>
      </div>
      <style>{`.dcs-db-close { background: transparent; border: none; transition: background-color 160ms ease; } .dcs-db-close:hover { background-color: rgba(255,255,255,0.18); }`}</style>
    </div>
  );
}
