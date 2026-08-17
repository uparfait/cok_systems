import React from "react";
import { get_field_text } from "./fieldText.js";

/**
 * Rate agreement on a numbered scale from 1 to scale_size.
 */
export default function LikertScaleField({ field, language, mode, value, onChange, error, ruleValidMessage }) {
  const is_builder = mode === "builder";
  const label = get_field_text(field.label, language);
  const help_text = get_field_text(field.help_text, language);
  const valid_message = ruleValidMessage || (field.mandatory && get_field_text(field.valid_message, language));
  const scale_size = field.scale_size || 5;
  const scale_points = Array.from({ length: scale_size }, (_unused, index) => index + 1);
  const low_label = get_field_text(field.low_label, language);
  const high_label = get_field_text(field.high_label, language);

  return (
    <div className="w-full">
      <label className="cok-auth-label" title={help_text || undefined}>
        {label}
        {field.mandatory && <span style={{ color: "#E74C3C" }}> *</span>}
      </label>
      <div className="flex items-center justify-between gap-2">
        {scale_points.map((point) => (
          <button
            key={point}
            type="button"
            disabled={is_builder}
            onClick={() => onChange && onChange(point)}
            className="flex-1 py-2 cursor-pointer border"
            style={{
              borderColor: value === point ? "#056daa" : "#E0E0E0",
              backgroundColor: value === point ? "#056daa" : "#FFFFFF",
              color: value === point ? "#FFFFFF" : "#333333",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 600,
            }}
          >
            {point}
          </button>
        ))}
      </div>
      {(low_label || high_label) && (
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs" style={{ color: "#9E9E9E" }}>{low_label}</span>
          <span className="text-xs" style={{ color: "#9E9E9E" }}>{high_label}</span>
        </div>
      )}
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
