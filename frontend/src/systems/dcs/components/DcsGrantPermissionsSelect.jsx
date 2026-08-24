import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const PRIMARY = "#056daa";
const PRIMARY_TINT = "#F0F7FB";

const ALL_OPTIONS = [
  { key: "add_forms", project_only: true, titleKey: "DCS_ACCESS_MANAGE_ADD", hintKey: "DCS_ACCESS_MANAGE_ADD_HINT" },
  { key: "edit_forms", project_only: false, titleKey: "DCS_ACCESS_MANAGE_EDIT", hintKey: "DCS_ACCESS_MANAGE_EDIT_HINT" },
  { key: "delete_forms", project_only: true, titleKey: "DCS_ACCESS_MANAGE_DELETE", hintKey: "DCS_ACCESS_MANAGE_DELETE_HINT" },
  { key: "share_forms", project_only: false, titleKey: "DCS_ACCESS_MANAGE_SHARE", hintKey: "DCS_ACCESS_MANAGE_SHARE_HINT" },
];

/**
 * Management actions of one individual grant, as a multi-select grid of
 * cards. Viewing the granted forms is always implied; each ticked card adds
 * one action on top: add / edit / delete / share (the grant option). A
 * project-wide grant (all forms) offers all four, a form-specific grant
 * only edit and share - adding and deleting are project-level actions.
 */
export default function DcsGrantPermissionsSelect({ isProjectScope, manage, onChange }) {
  const { translate } = useDcsLanguage();

  const selections = manage || {};
  const options = ALL_OPTIONS.filter((option) => isProjectScope || !option.project_only);

  const toggle = (key) => {
    onChange({ ...selections, [key]: selections[key] !== true });
  };

  return (
    <div>
      <p className="text-xs font-semibold uppercase mb-1" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
        {translate("DCS_ACCESS_MANAGE_LABEL")}
      </p>
      <p className="text-xs mb-2" style={{ color: "#9E9E9E" }}>
        {translate("DCS_ACCESS_MANAGE_HINT")}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-label={translate("DCS_ACCESS_MANAGE_LABEL")}>
        {options.map((option) => {
          const is_selected = selections[option.key] === true;
          return (
            <button
              key={option.key}
              type="button"
              role="checkbox"
              aria-checked={is_selected}
              onClick={() => toggle(option.key)}
              className="flex items-start gap-2 p-3 text-left border-2 w-full"
              style={{
                borderColor: is_selected ? PRIMARY : "#E0E0E0",
                backgroundColor: is_selected ? PRIMARY_TINT : "#FFFFFF",
                cursor: "pointer",
              }}
            >
              {/* Square tick drawn by hand so the cards read as a multi-select */}
              <span
                aria-hidden="true"
                className="flex-shrink-0 inline-flex items-center justify-center"
                style={{
                  width: 16,
                  height: 16,
                  marginTop: 2,
                  border: `2px solid ${is_selected ? PRIMARY : "#9E9E9E"}`,
                  backgroundColor: is_selected ? PRIMARY : "#FFFFFF",
                }}
              >
                {is_selected && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5.5L4 8L8.5 2.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="square" />
                  </svg>
                )}
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
