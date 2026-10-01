import React from "react";
import { get_field_text, get_field_options_state, find_matching_parent_option_groups } from "./fieldText.js";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useLazyFieldOptions } from "./useLazyFieldOptions.js";

/**
 * The actual dropdown + messaging, shared by both the ordinary (options
 * already in the schema) and lazy (options fetched on demand, see
 * SelectGroupField below) paths so they render identically either way.
 */
function SelectGroupControl({ label, helpText, mandatory, value, onChange, disabled, options, loading, language, error, validMessage, translate }) {
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
 * Choose one option from a list, rendered as a native dropdown instead of
 * radio rows - useful when the option list is long and radios would take up
 * too much vertical space. Optionally split into parent-driven condition
 * groups (field.parent_dependency_enabled) - see get_field_options_state -
 * in which case only the options belonging to a currently-matching group
 * show, and the field is disabled while none match.
 *
 * A field with more than a handful of real options (field.lazy_options,
 * see dc_backend/jsonlogic/lazy_options.js) never carries them in the
 * schema at all - only once it is actually rendered (never earlier) does it
 * fetch the options it currently needs through resolveFieldOptions: the
 * one matching parent_option_group's real options for a dependent field, or
 * the field's whole (still lazily-deferred) list for one with none. Nothing
 * is fetched at all while no group currently matches (nothing to show yet
 * anyway) or while resolveFieldOptions isn't supplied (the builder's own
 * static preview, which never renders a live control to begin with).
 */
export default function SelectGroupField({ field, language, mode, value, onChange, error, ruleValidMessage, allValues, resolveFieldOptions }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const label = get_field_text(field.label, language);
  const help_text = get_field_text(field.help_text, language);
  const valid_message = ruleValidMessage || (field.mandatory && get_field_text(field.valid_message, language));

  const is_lazy = !!field.lazy_options && !is_builder;
  const is_dependent = !!field.parent_dependency_enabled;
  const matching_groups = is_lazy && is_dependent ? find_matching_parent_option_groups(field, allValues) : null;
  const lazy_is_locked = is_lazy && is_dependent && matching_groups.length === 0;
  const lazy_fetch_key = !is_lazy
    ? null
    : is_dependent
      ? matching_groups
          .map((group) => group.id)
          .sort()
          .join(",")
      : "__flat__";
  const lazy_parent_value = is_lazy && is_dependent && matching_groups.length > 0 ? matching_groups[0].value : undefined;

  const lazy_state = useLazyFieldOptions(is_lazy && !lazy_is_locked, lazy_fetch_key, () =>
    resolveFieldOptions ? resolveFieldOptions(field, lazy_parent_value) : Promise.resolve([]),
  );

  if (is_lazy) {
    // No condition currently matches - there is nothing to answer, so the
    // whole field (not just its control) disappears rather than showing an
    // empty, disabled question.
    if (lazy_is_locked) return null;
    return (
      <SelectGroupControl
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

  const { visible_options: options, is_locked } = get_field_options_state(field, allValues, is_builder);

  // No condition currently matches - there is nothing to answer, so the
  // whole field (not just its control) disappears rather than showing an
  // empty, disabled question.
  if (is_locked) return null;

  return (
    <SelectGroupControl
      label={label}
      helpText={help_text}
      mandatory={field.mandatory}
      value={value}
      onChange={onChange}
      disabled={is_builder}
      options={options}
      loading={false}
      language={language}
      error={error}
      validMessage={valid_message}
      translate={translate}
    />
  );
}
