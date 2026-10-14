import React from "react";
import { get_field_text } from "../fieldText.js";
import { dcs_translate } from "../../i18n/index.js";

/**
 * The search icon sitting inside a searchable field's input, at the right:
 * looks the typed value up among the form's records. Off while there is
 * nothing typed to look for. top aligns it for a textarea; a single-line
 * input centres it.
 */
export function FieldSearchButton({ value, onSearch, language, top }) {
  const empty = value === undefined || value === null || String(value).trim() === "";
  const label = dcs_translate("DCS_FIELD_SEARCH_BTN", language);
  return (
    <button
      type="button"
      className={`absolute right-2 ${top ? "top-2" : "top-1/2 -translate-y-1/2"} w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors hover:bg-[rgba(5,109,170,0.12)] disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent dcs-no-print`}
      style={{ color: "#056daa", background: "none", border: "none" }}
      disabled={empty}
      onClick={onSearch}
      title={label}
      aria-label={label}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.5" y2="16.5" />
      </svg>
    </button>
  );
}

/** The input of a searchable field with the search icon inside it at the right. */
export function SearchableInput({ children, value, onSearch, language, top }) {
  return (
    <div className="relative">
      {children}
      <FieldSearchButton value={value} onSearch={onSearch} language={language} top={top} />
    </div>
  );
}

/**
 * Shared rendering for every free-text style field (text, number, email,
 * url, phone) - the label, mandatory mark, single input and its
 * translated help text, error and valid messages. onSearch, when given,
 * puts the search icon inside the input (record lookups).
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
      className={`cok-auth-input w-full py-3 ${onSearch ? "pr-12!" : ""}`}
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
        <SearchableInput value={value} onSearch={onSearch} language={language}>
          {input}
        </SearchableInput>
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
