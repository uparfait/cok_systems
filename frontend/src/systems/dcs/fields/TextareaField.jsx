import React from "react";
import { get_field_text } from "./fieldText.js";

/**
 * Multi-line free text answer ("Large text") - same label/help/error/valid
 * message chrome as BaseTextLikeField, but a resizable <textarea> instead
 * of a single-line <input>.
 */
export default function TextareaField({ field, language, mode, value, onChange, error, ruleValidMessage }) {
  const is_builder = mode === "builder";
  const label = get_field_text(field.label, language);
  const placeholder = get_field_text(field.placeholder, language);
  const help_text = get_field_text(field.help_text, language);
  const valid_message = ruleValidMessage || (field.mandatory && get_field_text(field.valid_message, language));

  return (
    <div className="w-full">
      <label className="cok-auth-label" title={help_text || undefined}>
        {label}
        {field.mandatory && <span style={{ color: "#E74C3C" }}> *</span>}
      </label>
      <textarea
        className="cok-auth-input w-full py-3"
        rows={field.rows || 5}
        placeholder={placeholder}
        value={value || ""}
        onChange={(event) => onChange && onChange(event.target.value)}
        disabled={is_builder}
        title={help_text || undefined}
      />
      {error && (
        <p className="mt-1 text-xs" style={{ color: "#E74C3C", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
          {error}
        </p>
      )}
      {!error && value && valid_message && (
        <p className="mt-1 text-xs" style={{ color: "#4CAF50", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
          {valid_message}
        </p>
      )}
    </div>
  );
}
