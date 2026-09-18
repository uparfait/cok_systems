import React from "react";
import { get_field_text, get_field_options_state } from "./fieldText.js";
import { is_option_blocked, next_selection } from "./exclusiveOptions.js";

/**
 * Choose multiple options from a list, rendered as touch-friendly
 * checkbox rows. Optionally split into parent-driven condition groups
 * (field.parent_dependency_enabled) - see get_field_options_state - in
 * which case only the options belonging to a currently-matching group
 * show, and every checkbox is disabled while none match.
 */
export default function MultiSelectField({ field, language, mode, value, onChange, error, ruleValidMessage, allValues }) {
  const is_builder = mode === "builder";
  const label = get_field_text(field.label, language);
  const help_text = get_field_text(field.help_text, language);
  const selected_values = Array.isArray(value) ? value : [];
  const valid_message = ruleValidMessage || (field.mandatory && get_field_text(field.valid_message, language));
  const { visible_options, is_locked } = get_field_options_state(field, allValues, is_builder);

  // An exclusive option ("Site not yet evaluated") replaces whatever was
  // ticked; while it is ticked the others are blocked, and vice versa.
  const toggle_option = (option_value) => {
    if (!onChange) return;
    onChange(next_selection(field, selected_values, option_value));
  };

  // No condition currently matches - there is nothing to answer, so the
  // whole field (not just its controls) disappears rather than showing an
  // empty, disabled question.
  if (is_locked) return null;

  return (
    <div className="w-full">
      <label className="cok-auth-label" title={help_text || undefined}>
        {label}
        {field.mandatory && <span style={{ color: "#E74C3C" }}> *</span>}
      </label>
      <div className="space-y-2">
        {visible_options.map((option) => (
          <label
            key={option.id}
            className="dcs-choice-row flex items-center gap-2 px-3 py-2 cursor-pointer"
          >
            <input
              type="checkbox"
              disabled={is_builder || is_option_blocked(field, option, selected_values)}
              checked={selected_values.includes(option.value)}
              onChange={() => toggle_option(option.value)}
              style={{ accentColor: "#056daa" }}
            />
            <span style={{ color: "#333333", fontSize: 14, opacity: !is_builder && is_option_blocked(field, option, selected_values) ? 0.5 : 1 }}>{get_field_text(option.label, language)}</span>
          </label>
        ))}
      </div>
      {error && (
        <p className="mt-1 text-xs" style={{ color: "#E74C3C", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
          {error}
        </p>
      )}
      {!error && selected_values.length > 0 && valid_message && (
        <p className="mt-1 text-xs" style={{ color: "#4CAF50", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
          {valid_message}
        </p>
      )}
    </div>
  );
}
