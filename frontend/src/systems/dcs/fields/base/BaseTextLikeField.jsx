import React from "react";
import { get_field_text } from "../fieldText.js";
import { dcs_translate } from "../../i18n/index.js";

/**
 * The text button beside a searchable field's input on a follow-up form:
 * looks the typed value up among the source form's records. Off while
 * there is nothing typed to look for.
 */
export function FieldSearchButton({ value, onSearch, language }) {
  const empty = value === undefined || value === null || String(value).trim() === "";
  return (
    <button type="button" className="cok-btn-outlined flex-shrink-0 px-3! dcs-no-print" style={{ minHeight: 46 }} disabled={empty} onClick={onSearch}>
      {dcs_translate("DCS_FU_SEARCH_BTN", language)}
    </button>
  );
}

/**
 * Shared rendering for every free-text style field (text, number, email,
 * url, phone) - the label, mandatory mark, single input and its
 * translated help text, error and valid messages. onSearch, when given,
 * puts a Search button beside the input (follow-up forms).
 */
export default function BaseTextLikeField({ field, language, mode, value, onChange, error, ruleValidMessage, inputType, extraInputProps, onSearch }) {
  const is_builder = mode === "builder";
  const label = get_field_text(field.label, language);
  const placeholder = get_field_text(field.placeholder, language);
  const help_text = get_field_text(field.help_text, language);
  const valid_message = ruleValidMessage || (field.mandatory && get_field_text(field.valid_message, language));

  const input = (
    <input
      type={inputType}
      className="cok-auth-input w-full py-3"
      placeholder={placeholder}
      value={value || ""}
      onChange={(event) => onChange && onChange(event.target.value)}
      disabled={is_builder}
      title={help_text || undefined}
      {...(extraInputProps || {})}
    />
  );

  return (
    <div className="w-full">
      <label className="cok-auth-label" title={help_text || undefined}>
        {label}
        {field.mandatory && <span style={{ color: "#E74C3C" }}> *</span>}
      </label>
      {onSearch ? (
        <div className="flex items-stretch gap-2">
          <div className="min-w-0 flex-1">{input}</div>
          <FieldSearchButton value={value} onSearch={onSearch} language={language} />
        </div>
      ) : (
        input
      )}
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
