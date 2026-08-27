import React from "react";
import { get_field_text, get_parent_linked_options_state, trimmed_lookup, has_real_answer } from "./fieldText.js";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useLazyFieldOptions } from "./useLazyFieldOptions.js";

/**
 * The actual dropdown + messaging, shared by both the ordinary (options
 * already in the schema) and lazy (options fetched on demand) paths so
 * they render identically either way.
 */
function CascadingSelectControl({ label, helpText, mandatory, value, onChange, disabled, options, loading, language, error, validMessage, translate }) {
  return (
    <div className="w-full">
      <label className="cok-auth-label" title={helpText || undefined}>
        {label}
        {mandatory && <span style={{ color: "#E74C3C" }}> *</span>}
      </label>
      <select
        className="cok-auth-input w-full py-3"
        value={value || ""}
        disabled={disabled || loading}
        onChange={(event) => onChange && onChange(event.target.value)}
        title={helpText || undefined}
      >
        <option value="" disabled>
          {loading ? translate("DCS_FIELD_OPTIONS_LOADING") : translate("DCS_RENDERER_SELECT_PLACEHOLDER")}
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
      {!error && value && validMessage && (
        <p className="mt-1 text-xs" style={{ color: "#4CAF50", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
          {validMessage}
        </p>
      )}
    </div>
  );
}

/**
 * Filters its options based on the current answer of another field
 * (field.parent_field_id), only ever showing children that belong to the
 * parent's selected value - see get_parent_linked_options_state, the same
 * helper single/multi select and select group use for their own optional
 * parent link.
 *
 * A field with more than a handful of real options (field.lazy_options,
 * see dc_backend/jsonlogic/lazy_options.js) never carries them in the
 * schema at all - field.parent_field_id itself is never stripped, so once
 * the parent actually has an answer this fetches only the options tagged
 * for that exact value through resolveFieldOptions, instead of the whole
 * (possibly huge) list.
 */
export default function CascadingSelectField({ field, language, mode, value, onChange, error, allValues, ruleValidMessage, resolveFieldOptions }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const label = get_field_text(field.label, language);
  const help_text = get_field_text(field.help_text, language);
  const valid_message = ruleValidMessage || (field.mandatory && get_field_text(field.valid_message, language));

  const is_lazy = !!field.lazy_options && !is_builder;
  const lazy_parent_value = is_lazy && field.parent_field_id ? trimmed_lookup(allValues, field.parent_field_id) : undefined;
  const lazy_parent_unanswered = is_lazy && field.parent_field_id ? !has_real_answer(lazy_parent_value) : false;
  const lazy_fetch_key = is_lazy ? (field.parent_field_id ? String(lazy_parent_value) : "__flat__") : null;

  const lazy_state = useLazyFieldOptions(is_lazy && !lazy_parent_unanswered, lazy_fetch_key, () =>
    resolveFieldOptions ? resolveFieldOptions(field, field.parent_field_id ? lazy_parent_value : undefined) : Promise.resolve([]),
  );

  if (is_lazy) {
    // The parent has no answer yet - there is nothing to answer here
    // either, so the whole field (not just its control) disappears rather
    // than showing an empty, disabled question.
    if (lazy_parent_unanswered) return null;
    return (
      <CascadingSelectControl
        label={label}
        helpText={help_text}
        mandatory={field.mandatory}
        value={value}
        onChange={onChange}
        disabled={is_builder}
        options={lazy_state.options}
        loading={lazy_state.loading}
        language={language}
        error={error}
        validMessage={valid_message}
        translate={translate}
      />
    );
  }

  const { visible_options, parent_unanswered } = get_parent_linked_options_state(field, allValues, is_builder);

  // The parent has no answer yet - there is nothing to answer here either,
  // so the whole field (not just its control) disappears rather than
  // showing an empty, disabled question.
  if (parent_unanswered) return null;

  return (
    <CascadingSelectControl
      label={label}
      helpText={help_text}
      mandatory={field.mandatory}
      value={value}
      onChange={onChange}
      disabled={is_builder}
      options={visible_options}
      loading={false}
      language={language}
      error={error}
      validMessage={valid_message}
      translate={translate}
    />
  );
}
