import React, { useState, useEffect, useRef } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const PRIMARY = "#056daa";
const PRIMARY_TINT = "#F0F7FB";

// share_forms is not here - the grant option is its own toggle button.
const SELECT_OPTIONS = [
  { key: "add_forms", project_only: true, titleKey: "DCS_ACCESS_MANAGE_ADD", hintKey: "DCS_ACCESS_MANAGE_ADD_HINT" },
  { key: "edit_forms", project_only: false, titleKey: "DCS_ACCESS_MANAGE_EDIT", hintKey: "DCS_ACCESS_MANAGE_EDIT_HINT" },
  { key: "delete_forms", project_only: true, titleKey: "DCS_ACCESS_MANAGE_DELETE", hintKey: "DCS_ACCESS_MANAGE_DELETE_HINT" },
];

const tick_square = (is_selected) => ({
  width: 16,
  height: 16,
  marginTop: 2,
  border: `2px solid ${is_selected ? PRIMARY : "#9E9E9E"}`,
  backgroundColor: is_selected ? PRIMARY : "#FFFFFF",
});

/**
 * Management actions of one grant (individual or department), as two
 * buttons side by side: "Select access" opens a dropdown of form accesses
 * (add / edit / delete), while "Grant option" (share_forms) toggles
 * directly with no dropdown. Ticked accesses appear as removable chips
 * underneath. Viewing the granted forms is always implied. A project-wide
 * grant (all forms) offers all accesses, a form-specific grant only edit -
 * adding and deleting are project-level actions. labelKey/hintKey swap the
 * person wording for the department one.
 */
export default function DcsGrantPermissionsSelect({ isProjectScope, manage, onChange, labelKey, hintKey }) {
  const { translate } = useDcsLanguage();
  const [is_open, setIsOpen] = useState(false);
  const container_ref = useRef(null);

  useEffect(() => {
    const handle_click_outside = (event) => {
      if (container_ref.current && !container_ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handle_click_outside);
    return () => document.removeEventListener("mousedown", handle_click_outside);
  }, []);

  const selections = manage || {};
  const options = SELECT_OPTIONS.filter((option) => isProjectScope || !option.project_only);
  const selected_options = options.filter((option) => selections[option.key] === true);
  const has_grant_option = selections.share_forms === true;

  // The grant option and hand-picked accesses are mutually exclusive:
  // picking an access drops the grant option, and enabling the grant
  // option clears every picked access.
  const toggle = (key) => {
    if (key === "share_forms") {
      const turning_on = selections.share_forms !== true;
      onChange(
        turning_on
          ? { add_forms: false, edit_forms: false, delete_forms: false, share_forms: true }
          : { ...selections, share_forms: false },
      );
      return;
    }
    onChange({ ...selections, [key]: selections[key] !== true, share_forms: false });
  };

  return (
    <div>
      <p className="text-xs font-semibold uppercase mb-1" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
        {translate(labelKey || "DCS_ACCESS_MANAGE_LABEL")}
      </p>
      <p className="text-xs mb-2" style={{ color: "#9E9E9E" }}>
        {translate(hintKey || "DCS_ACCESS_MANAGE_HINT")}
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <div ref={container_ref} className="relative w-full sm:max-w-xs">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={is_open}
            onClick={() => setIsOpen(!is_open)}
            className="cok-auth-input w-full py-3 flex items-center justify-between gap-2 text-left"
            style={{ cursor: "pointer" }}
          >
            <span className="text-sm truncate" style={{ color: "#333333" }}>
              {translate("DCS_ACCESS_SELECT_ACCESS")}
              {selected_options.length > 0 && ` (${selected_options.length})`}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
              className="flex-shrink-0"
              style={{ transform: is_open ? "rotate(180deg)" : "none" }}
            >
              <path d="M2 4L6 8L10 4" stroke="#9E9E9E" strokeWidth="2" strokeLinecap="square" />
            </svg>
          </button>

          {is_open && (
            <div
              role="listbox"
              aria-label={translate("DCS_ACCESS_SELECT_ACCESS")}
              className="absolute left-0 right-0 z-50 mt-1 bg-white border-2"
              style={{ borderColor: "#E0E0E0" }}
            >
              {options.map((option) => {
                const is_selected = selections[option.key] === true;
                return (
                  <div
                    key={option.key}
                    role="option"
                    aria-selected={is_selected}
                    onClick={() => toggle(option.key)}
                    className="flex items-start gap-2 px-3 py-2 cursor-pointer"
                    style={{ backgroundColor: is_selected ? PRIMARY_TINT : "#FFFFFF" }}
                  >
                    {/* Square tick drawn by hand so the rows read as a multi-select */}
                    <span aria-hidden="true" className="flex-shrink-0 inline-flex items-center justify-center" style={tick_square(is_selected)}>
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={has_grant_option}
          title={translate("DCS_ACCESS_MANAGE_SHARE_HINT")}
          onClick={() => toggle("share_forms")}
          className="flex items-center gap-2 px-3 py-3 border-2 w-full sm:w-auto sm:flex-shrink-0"
          style={{
            borderColor: has_grant_option ? PRIMARY : "#E0E0E0",
            backgroundColor: has_grant_option ? PRIMARY_TINT : "#FFFFFF",
            cursor: "pointer",
          }}
        >
          <span aria-hidden="true" className="flex-shrink-0 inline-flex items-center justify-center" style={{ ...tick_square(has_grant_option), marginTop: 0 }}>
            {has_grant_option && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5.5L4 8L8.5 2.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="square" />
              </svg>
            )}
          </span>
          <span
            className="text-sm font-semibold whitespace-nowrap"
            style={{ color: has_grant_option ? PRIMARY : "#333333", fontFamily: "'Montserrat', sans-serif" }}
          >
            {translate("DCS_ACCESS_GRANT_BADGE")}
          </span>
        </button>
      </div>

      {selected_options.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selected_options.map((option) => (
            <span
              key={option.key}
              className="inline-flex items-center gap-2 text-xs font-semibold px-2 py-1"
              style={{ color: PRIMARY, backgroundColor: PRIMARY_TINT, border: `1px solid ${PRIMARY}` }}
            >
              {translate(option.titleKey)}
              <button
                type="button"
                onClick={() => toggle(option.key)}
                aria-label={translate("DCS_SETTINGS_REMOVE")}
                className="leading-none"
                style={{ color: PRIMARY, fontSize: 14 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
