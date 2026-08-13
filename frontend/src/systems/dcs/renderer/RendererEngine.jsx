import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { dcs_supported_languages, dcs_default_language } from "../i18n/index.js";
import { DCS_FIELD_RENDERER_MAP } from "./fieldRendererMap.js";
import { evaluate_field_visibility } from "./formEngine.js";

const LANGUAGE_LABEL_KEYS = { en: "DCS_LANGUAGE_EN", kn: "DCS_LANGUAGE_KN", fr: "DCS_LANGUAGE_FR" };

/**
 * Universal, schema-driven form renderer. Reads the JSON schema field by
 * field, maps each type to its component, applies visibility conditions,
 * and recurses into groups - it never hardcodes knowledge of any specific
 * form. Width always fills its container up to 500px, height follows its
 * own content.
 */
export default function RendererEngine({ schema, mode, values, onValueChange, fieldErrors, fieldValidMessages, onFieldChange, wrapField }) {
  const render_mode = mode || "renderer";
  const { translate } = useDcsLanguage();
  const [form_language, setFormLanguage] = useState(dcs_default_language);

  const format_error = (field_id) => {
    const entries = fieldErrors ? fieldErrors[field_id] : null;
    if (!entries || entries.length === 0) return null;
    return entries.map((entry) => (typeof entry === "string" ? entry : entry.message)).join("\n");
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
        onChange={(next_value) => onValueChange && onValueChange(field.id, next_value)}
        error={format_error(field.id)}
        ruleValidMessage={fieldValidMessages ? fieldValidMessages[field.id] : undefined}
        onFieldChange={onFieldChange}
        allValues={values}
        renderChildField={render_field}
      />
    );

    return wrapField ? wrapField(element, field) : element;
  };

  return (
    <div className="w-full mx-auto" style={{ maxWidth: 500 }}>
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

      <div className="space-y-4 w-full">{(schema && schema.fields ? schema.fields : []).map((field) => render_field(field))}</div>
    </div>
  );
}
