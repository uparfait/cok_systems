import React, { useState, useEffect, useRef } from "react";
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
 * Management actions of one individual grant, as a "Select access" dropdown
 * in the same style as the department/unit selects. The button opens the
 * list of accesses (add / edit / delete / share); ticked ones appear as
 * removable chips under the button. Viewing the granted forms is always
 * implied. A project-wide grant (all forms) offers all four accesses, a
 * form-specific grant only edit and share - adding and deleting are
 * project-level actions.
 */
export default function DcsGrantPermissionsSelect({ isProjectScope, manage, onChange }) {
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
  const options = ALL_OPTIONS.filter((option) => isProjectScope || !option.project_only);
  const selected_options = options.filter((option) => selections[option.key] === true);

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

      <div ref={container_ref} className="relative sm:max-w-xs">
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
            aria-label={translate("DCS_ACCESS_MANAGE_LABEL")}
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
                </div>
              );
            })}
          </div>
        )}
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
