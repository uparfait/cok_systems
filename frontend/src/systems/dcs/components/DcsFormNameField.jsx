import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

/**
 * Internal-only form name, entered above the DC form builder - never shown
 * to a respondent, only used to tell forms apart when listing them.
 */
export default function DcsFormNameField({ value, onChange }) {
  const { translate } = useDcsLanguage();
  const is_empty = !value || !value.trim();

  return (
    <div className="mb-4">
      <label className="cok-auth-label">{translate("DCS_FIELD_FORM_NAME")}</label>
      <input
        className="cok-auth-input w-full py-3"
        placeholder={translate("DCS_FIELD_FORM_NAME_PLACEHOLDER")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
      {is_empty && (
        <p className="text-xs mt-1" style={{ color: "#E74C3C" }}>
          {translate("DCS_FIELD_FORM_NAME_REQUIRED")}
        </p>
      )}
    </div>
  );
}
