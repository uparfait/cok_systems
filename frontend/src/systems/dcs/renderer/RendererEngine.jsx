import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { dcs_supported_languages, dcs_default_language } from "../i18n/index.js";
import { DCS_FIELD_RENDERER_MAP } from "./fieldRendererMap.js";
import { evaluate_field_visibility } from "./formEngine.js";
import { build_design_styles, get_spacing_below_px } from "./designStyles.js";

const LANGUAGE_LABEL_KEYS = { en: "DCS_LANGUAGE_EN", kn: "DCS_LANGUAGE_KN", fr: "DCS_LANGUAGE_FR" };

/**
 * Universal, schema-driven form renderer. Reads the JSON schema field by
 * field, maps each type to its component, applies visibility conditions,
 * and recurses into groups - it never hardcodes knowledge of any specific
 * form. Width always fills its container up to 700px and down to 100% on
 * any smaller device; text wraps normally rather than being scaled.
 */
export default function RendererEngine({ schema, mode, values, onValueChange, fieldErrors, fieldValidMessages, onFieldChange, wrapField, revealAllErrors }) {
  const render_mode = mode || "renderer";
  const { translate } = useDcsLanguage();
  const [form_language, setFormLanguage] = useState(dcs_default_language);
  const [touched_fields, setTouchedFields] = useState(() => new Set());

  const mark_touched = (field_id) => {
    setTouchedFields((previous) => (previous.has(field_id) ? previous : new Set(previous).add(field_id)));
  };

  // A field only ever shows its error (or its rule's success message) once
  // the respondent has actually edited it, or after a submit attempt has
  // revealed everything - never for a field further down the form the
  // respondent hasn't reached yet just because typing elsewhere happened
  // to re-run validation across the whole schema. Landing focus on a field
  // without editing it does not count as touching it.
  const is_shown = (field_id) => revealAllErrors || touched_fields.has(field_id);

  const format_error = (field_id) => {
    if (!is_shown(field_id)) return null;
    const entries = fieldErrors ? fieldErrors[field_id] : null;
    if (!entries || entries.length === 0) return null;
    return entries.map((entry) => (typeof entry === "string" ? entry : entry.message)).join("\n");
  };

  const format_valid_message = (field_id) => {
    if (!is_shown(field_id)) return undefined;
    return fieldValidMessages ? fieldValidMessages[field_id] : undefined;
  };

  const render_field = (field) => {
    const FieldComponent = DCS_FIELD_RENDERER_MAP[field.type];
    if (!FieldComponent) return null;

    if (render_mode === "renderer" && !evaluate_field_visibility(field, values)) {
      return null;
    }

    const element = (
      <FieldComponent
        key={field.id}
        field={field}
        language={form_language}
        mode={render_mode}
        value={values ? values[field.id] : undefined}
        onChange={(next_value) => {
          mark_touched(field.id);
          onValueChange && onValueChange(field.id, next_value);
        }}
        error={format_error(field.id)}
        ruleValidMessage={format_valid_message(field.id)}
        onFieldChange={onFieldChange}
        allValues={values}
        renderChildField={render_field}
      />
    );

    const { outer_style, inner_style } = build_design_styles(field);
    const designed_element = outer_style ? (
      <div key={field.id} style={outer_style}>
        <div style={inner_style}>{element}</div>
      </div>
    ) : (
      <div key={field.id} style={inner_style}>
        {element}
      </div>
    );

    return wrapField ? wrapField(designed_element, field) : designed_element;
  };

  // The gap after a top-level field is whatever the author set for it
  // (Designs tab), not a single hardcoded value shared by every component.
  // This only applies to the form's own top-to-bottom field list: a
  // component placed inside a Section canvas is positioned by the
  // author's chosen x/y/width/height percentages, not by a between-
  // components margin, so render_field (reused as renderChildField for
  // Section/Group children) must never carry this spacing itself - it
  // would silently inflate every nested component's box on top of the
  // position the author actually designed.
  const render_top_level_field = (field) => {
    const element = render_field(field);
    if (element === null) return null;
    return (
      <div key={field.id} style={{ marginBottom: get_spacing_below_px(field) }}>
        {element}
      </div>
    );
  };

  return (
    <div className="w-full mx-auto" style={{ maxWidth: 700 }}>
      <div className="flex items-center justify-end mb-3">
        <select
          aria-label={translate("DCS_RENDERER_LANGUAGE_LABEL")}
          value={form_language}
          onChange={(event) => setFormLanguage(event.target.value)}
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            border: "1px solid #E0E0E0",
            borderRadius: 0,
            padding: "0.3rem 0.5rem",
          }}
        >
          {dcs_supported_languages.map((language_code) => (
            <option key={language_code} value={language_code}>
              {translate(LANGUAGE_LABEL_KEYS[language_code])}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full">{(schema && schema.fields ? schema.fields : []).map((field) => render_top_level_field(field))}</div>
    </div>
  );
}
