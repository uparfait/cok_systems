import React from "react";
import { get_field_text } from "./fieldText.js";

/**
 * Elapsed time entry field, captured as separate hours and minutes inputs.
 */
export default function DurationField({ field, language, mode, value, onChange, error, ruleValidMessage }) {
  const is_builder = mode === "builder";
  const label = get_field_text(field.label, language);
  const help_text = get_field_text(field.help_text, language);
  const valid_message = ruleValidMessage || (field.mandatory && get_field_text(field.valid_message, language));
  const current_value = value || { hours: "", minutes: "" };

  const update_part = (part, part_value) => {
    if (!onChange) return;
    onChange(Object.assign({}, current_value, { [part]: part_value }));
  };

  return (
    <div className="w-full">
      <label className="cok-auth-label" title={help_text || undefined}>
        {label}
        {field.mandatory && <span style={{ color: "#E74C3C" }}> *</span>}
      </label>
      <div className="flex gap-3">
        <input
          type="number"
          min="0"
          disabled={is_builder}
          className="cok-auth-input w-full py-3"
          placeholder="0"
          title={help_text || undefined}
          value={current_value.hours}
          onChange={(event) => update_part("hours", event.target.value)}
        />
        <input
          type="number"
          min="0"
          max="59"
          disabled={is_builder}
          className="cok-auth-input w-full py-3"
          placeholder="0"
          title={help_text || undefined}
          value={current_value.minutes}
          onChange={(event) => update_part("minutes", event.target.value)}
        />
      </div>
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
