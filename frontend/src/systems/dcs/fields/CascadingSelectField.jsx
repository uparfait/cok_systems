import React from "react";
import { get_field_text, get_parent_linked_options_state } from "./fieldText.js";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

/**
 * Filters its options based on the current answer of another field
 * (field.parent_field_id), only ever showing children that belong to the
 * parent's selected value - see get_parent_linked_options_state, the same
 * helper single/multi select and select group use for their own optional
 * parent link.
 */
export default function CascadingSelectField({ field, language, mode, value, onChange, error, allValues, ruleValidMessage }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const label = get_field_text(field.label, language);
  const help_text = get_field_text(field.help_text, language);
  const valid_message = ruleValidMessage || (field.mandatory && get_field_text(field.valid_message, language));
  const { visible_options, parent_unanswered } = get_parent_linked_options_state(field, allValues, is_builder);

  // The parent has no answer yet - there is nothing to answer here either,
  // so the whole field (not just its control) disappears rather than
  // showing an empty, disabled question.
  if (parent_unanswered) return null;

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
        {visible_options.map((option) => (
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
        <p className="mt-1 text-xs" style={{ color: "#4CAF50", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
          {valid_message}
        </p>
      )}
    </div>
  );
}
