import React from "react";
import { get_field_text } from "./fieldText.js";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

/**
 * Choose one option from a list, rendered as a native dropdown instead of
 * radio rows - useful when the option list is long and radios would take up
 * too much vertical space.
 */
export default function SelectGroupField({ field, language, mode, value, onChange, error, ruleValidMessage }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const label = get_field_text(field.label, language);
  const help_text = get_field_text(field.help_text, language);
  const valid_message = ruleValidMessage || (field.mandatory && get_field_text(field.valid_message, language));
  const options = field.options || [];

  return (
    <div className="w-full">
      <label className="cok-auth-label" title={help_text || undefined}>
        {label}
        {field.mandatory && <span style={{ color: "#E74C3C" }}> *</span>}
      </label>
      <select
        className="cok-auth-input w-full py-3"
        value={value || ""}
        disabled={is_builder}
        onChange={(event) => onChange && onChange(event.target.value)}
        title={help_text || undefined}
      >
        <option value="" disabled>
          {translate("DCS_RENDERER_SELECT_PLACEHOLDER")}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.value}>
            {get_field_text(option.label, language)}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-xs" style={{ color: "#E74C3C", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
          {error}
        </p>
      )}
      {!error && value && valid_message && (
        <p className="mt-1 text-xs" style={{ color: "#4CAF50", fontFamily: "'Montserrat', sans-serif" }}>
          {valid_message}
        </p>
      )}
    </div>
  );
}
