import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsStepCheckIcon from "./DcsStepCheckIcon.jsx";

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";

/**
 * Horizontal step header for a multi-part flow (sec1, sec2, sec3...):
 * finished steps turn green with an animated checkmark, the current step is
 * highlighted, and a step beyond the furthest one reached is disabled.
 */
export default function DcsWizardSteps({ steps, currentIndex, maxReachedIndex, onSelect }) {
  const { translate } = useDcsLanguage();

  return (
    <div className="flex items-center w-full mb-6">
      {steps.map((step, index) => {
        const is_completed = index < maxReachedIndex;
        const is_current = index === currentIndex;
        const is_reachable = index <= maxReachedIndex;
        const is_last = index === steps.length - 1;
        const badge_color = is_completed ? SUCCESS : is_current ? PRIMARY : "#CCCCCC";

        return (
          <React.Fragment key={step.key}>
            <button
              type="button"
              disabled={!is_reachable}
              onClick={() => is_reachable && onSelect(index)}
              className="flex items-center gap-2 flex-shrink-0"
              style={{ cursor: is_reachable ? "pointer" : "not-allowed" }}
            >
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  backgroundColor: badge_color,
                  color: "#FFFFFF",
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  transition: "background-color 0.25s ease",
                }}
              >
                {is_completed ? <DcsStepCheckIcon /> : index + 1}
              </span>
              <span
                className="text-sm hidden sm:inline"
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: is_current ? 700 : 500,
                  color: is_current ? PRIMARY : is_completed ? SUCCESS : "#9E9E9E",
                }}
              >
                {translate(step.labelKey)}
              </span>
            </button>
            {!is_last && (
              <div
                className="flex-1 mx-2"
                style={{ height: 2, backgroundColor: is_completed ? SUCCESS : "#E0E0E0", transition: "background-color 0.25s ease" }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
