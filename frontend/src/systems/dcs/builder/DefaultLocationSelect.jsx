import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useLocationOptions } from "../fields/locationOptions.js";

/**
 * The default-value control of an API-sourced location field: the real
 * locations of its level fetched from the same source the live form uses
 * (narrowed to the ones under a known parent answer), offered as a
 * dropdown so the stored name can never be mistyped. While the list loads
 * the dropdown waits; if it cannot load at all, a typed name with a retry
 * is the fallback.
 */
export default function DefaultLocationSelect({ field, ancestor, value, onChange }) {
  const { translate } = useDcsLanguage();
  const { options, loading, failed, retry } = useLocationOptions(field, ancestor);
  const current = value === undefined || value === null ? "" : String(value);

  if (failed) {
    return (
      <div>
        <input type="text" className="cok-auth-input w-full py-2" value={current} onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)} placeholder={translate("DCS_DEFAULT_LOCATION_TYPE_NAME")} />
        <p className="text-xs mt-1 flex items-center gap-2" style={{ color: "#9E9E9E" }}>
          <span>{translate("DCS_DEFAULT_LOCATIONS_FAILED")}</span>
          <button type="button" className="text-xs font-semibold cursor-pointer" style={{ color: "#056daa", background: "none", border: "none", padding: 0 }} onClick={retry}>
            {translate("DCS_DB_RETRY")}
          </button>
        </p>
      </div>
    );
  }

  const known = options.some((option) => option.value === current);
  return (
    <select className="cok-auth-input w-full py-2" value={current} disabled={loading} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">{loading ? translate("DCS_FIELD_OPTIONS_LOADING") : translate(ancestor ? "DCS_DEFAULT_PICK" : "DCS_DEFAULT_PICK_LOCATION")}</option>
      {current && !known && <option value={current}>{current}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
