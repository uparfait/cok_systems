import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const PRIMARY = "#056daa";
const PRIMARY_TINT = "#F0F7FB";

/**
 * Access level of one individual grant, rendered as two selectable cards:
 * "Access" (may only open the granted forms) or "With grant option" (may
 * also grant and restrict access to this project for other people).
 */
export default function DcsAccessLevelSelect({ canGrant, onChange }) {
  const { translate } = useDcsLanguage();

  const OPTIONS = [
    {
      can_grant: false,
      titleKey: "DCS_ACCESS_LEVEL_ACCESS",
      hintKey: "DCS_ACCESS_LEVEL_ACCESS_HINT",
    },
    {
      can_grant: true,
      titleKey: "DCS_ACCESS_LEVEL_GRANT",
      hintKey: "DCS_ACCESS_LEVEL_GRANT_HINT",
    },
  ];

  return (
    <div>
      <p className="text-xs font-semibold uppercase mb-1" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
        {translate("DCS_ACCESS_LEVEL_LABEL")}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label={translate("DCS_ACCESS_LEVEL_LABEL")}>
        {OPTIONS.map((option) => {
          const is_selected = canGrant === option.can_grant;
          return (
            <button
              key={String(option.can_grant)}
              type="button"
              role="radio"
              aria-checked={is_selected}
              onClick={() => onChange(option.can_grant)}
              className="flex items-start gap-2 p-3 text-left border-2 w-full"
              style={{
                borderColor: is_selected ? PRIMARY : "#E0E0E0",
                backgroundColor: is_selected ? PRIMARY_TINT : "#FFFFFF",
                cursor: "pointer",
              }}
            >
              {/* Radio dot drawn by hand so the two cards read as one exclusive choice */}
              <span
                aria-hidden="true"
                className="flex-shrink-0 inline-flex items-center justify-center"
                style={{
                  width: 16,
                  height: 16,
                  marginTop: 2,
                  borderRadius: "50%",
                  border: `2px solid ${is_selected ? PRIMARY : "#9E9E9E"}`,
                }}
              >
                {is_selected && <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: PRIMARY }} />}
              </span>
              <span className="min-w-0">
                <span
                  className="block text-sm font-semibold"
                  style={{ color: is_selected ? PRIMARY : "#333333", fontFamily: "'Montserrat', sans-serif" }}
                >
                  {translate(option.titleKey)}
                </span>
                <span className="block text-xs mt-0.5" style={{ color: "#9E9E9E" }}>
                  {translate(option.hintKey)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
