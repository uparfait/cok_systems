import React from "react";
import { get_field_text } from "./fieldText.js";

/**
 * Choose one option from a list, rendered as touch-friendly radio rows.
 */
export default function SingleSelectField({ field, language, mode, value, onChange, error, ruleValidMessage }) {
  const is_builder = mode === "builder";
  const label = get_field_text(field.label, language);
  const help_text = get_field_text(field.help_text, language);
  const valid_message = ruleValidMessage || (field.mandatory && get_field_text(field.valid_message, language));

  return (
    <div className="w-full">
      <label className="cok-auth-label" title={help_text || undefined}>
        {label}
        {field.mandatory && <span style={{ color: "#E74C3C" }}> *</span>}
      </label>
      <div className="space-y-2">
        {(field.options || []).map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-2 px-3 py-2 border cursor-pointer"
            style={{ borderColor: "#E0E0E0" }}
          >
            <input
              type="radio"
              name={field.id}
              disabled={is_builder}
              checked={value === option.value}
              onChange={() => onChange && onChange(option.value)}
              style={{ accentColor: "#056daa" }}
            />
            <span style={{ color: "#333333", fontSize: 14 }}>{get_field_text(option.label, language)}</span>
          </label>
        ))}
      </div>
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
