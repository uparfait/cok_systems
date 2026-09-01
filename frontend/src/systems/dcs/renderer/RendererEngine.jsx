import React, { useState, useEffect, useRef, useCallback } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { dcs_supported_languages } from "../i18n/index.js";
import { DCS_FIELD_RENDERER_MAP } from "./fieldRendererMap.js";
import { evaluate_field_visibility } from "./formEngine.js";
import { build_design_styles, get_spacing_below_px } from "./designStyles.js";
import { LocationDataProvider } from "../fields/CascadingSelectField.jsx";

const LANGUAGE_LABEL_KEYS = { en: "DCS_LANGUAGE_EN", kn: "DCS_LANGUAGE_KN", fr: "DCS_LANGUAGE_FR" };

function has_location_sourced_fields(fields) {
  if (!Array.isArray(fields)) return false;
  return fields.some(field => {
    if (field.data_source?.type === "api") return true;
    if (field.children?.length) return has_location_sourced_fields(field.children);
    return false;
  });
}

function flatten_fields(fields) {
  if (!Array.isArray(fields)) return [];
  const result = [];
  for (const field of fields) {
    result.push(field);
    if (field.children?.length) {
      result.push(...flatten_fields(field.children));
    }
  }
  return result;
}

function useInViewFields() {
  const [visibleFields, setVisibleFields] = useState(() => new Set());
  const observerRef = useRef(null);
  const fieldElementsRef = useRef(new Map());

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        setVisibleFields((prev) => {
          const next = new Set(prev);
          entries.forEach((entry) => {
            const fieldId = entry.target.dataset.fieldId;
            if (fieldId) {
              if (entry.isIntersecting) {
                next.add(fieldId);
              } else {
                next.delete(fieldId);
              }
            }
          });
          return next;
        });
      },
      {
        root: null,
        rootMargin: "100px",
        threshold: 0.1
      }
    );

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  const registerField = useCallback((fieldId, element) => {
    if (element && observerRef.current) {
      fieldElementsRef.current.set(fieldId, element);
      observerRef.current.observe(element);
    }
  }, []);

  const unregisterField = useCallback((fieldId) => {
    const element = fieldElementsRef.current.get(fieldId);
    if (element && observerRef.current) {
      observerRef.current.unobserve(element);
      fieldElementsRef.current.delete(fieldId);
    }
  }, []);

  return { visibleFields, registerField, unregisterField };
}

export default function RendererEngine({ schema, mode, values, onValueChange, fieldErrors, fieldValidMessages, onFieldChange, wrapField, revealAllErrors, resolveFieldOptions }) {
  const render_mode = mode || "renderer";
  const { language: form_language, setLanguage: setFormLanguage, translate } = useDcsLanguage();
  const [touched_fields, setTouchedFields] = useState(() => new Set());
  const { visibleFields, registerField, unregisterField } = useInViewFields();

  const mark_touched = (field_id) => {
    setTouchedFields((previous) => (previous.has(field_id) ? previous : new Set(previous).add(field_id)));
  };

  const find_child_field_ids = (parent_field_id, fields = schema?.fields) => {
    const children = [];
    if (!fields) return children;
    for (const field of fields) {
      if (field.parent_field_id === parent_field_id) {
        children.push(field.id);
      }
      if (field.children) {
        children.push(...find_child_field_ids(parent_field_id, field.children));
      }
    }
    return children;
  };

  const handle_cascading_change = (field_id, next_value) => {
    mark_touched(field_id);
    onValueChange && onValueChange(field_id, next_value);

    const child_ids = find_child_field_ids(field_id);
    for (const child_id of child_ids) {
      onValueChange && onValueChange(child_id, undefined);
    }
  };

  const is_shown = (field_id) => {
    if (revealAllErrors) return true;
    if (!visibleFields.has(field_id)) return false;
    return touched_fields.has(field_id);
  };

  const format_error = (field_id) => {
    if (!is_shown(field_id)) return null;
    const entries = fieldErrors ? fieldErrors[field_id] : null;
    if (!entries || entries.length === 0) return null;
    return entries.map((entry) => (typeof entry === "string" ? entry : entry.message)).join("\n");
  };

  const format_valid_message = (field_id) => {
    if (!is_shown(field_id)) return undefined;
    const entries = fieldValidMessages ? fieldValidMessages[field_id] : undefined;
    if (!entries) return undefined;
    return Array.isArray(entries) ? entries.join("\n") : entries;
  };

  const render_field = (field) => {
    const FieldComponent = DCS_FIELD_RENDERER_MAP[field.type];
    if (!FieldComponent) return null;

    if (render_mode === "renderer" && !evaluate_field_visibility(field, values)) {
      return null;
    }

    const is_cascading_location = field.type === "cascading_select" && field.data_source?.type === "api";

    const element = (
      <FieldComponent
        key={field.id}
        field={field}
        language={form_language}
        mode={render_mode}
        value={values ? values[field.id] : undefined}
        onChange={(next_value) => {
          if (is_cascading_location) {
            handle_cascading_change(field.id, next_value);
          } else {
            mark_touched(field.id);
            onValueChange && onValueChange(field.id, next_value);
          }
        }}
        error={format_error(field.id)}
        ruleValidMessage={format_valid_message(field.id)}
        onFieldChange={onFieldChange}
        allValues={values}
        renderChildField={render_field}
        resolveFieldOptions={resolveFieldOptions}
        allFields={flatten_fields(schema?.fields)}
      />
    );

    const has_error_highlight = render_mode === "renderer" && !!format_error(field.id);
    const error_highlight_class = has_error_highlight ? "dcs-field-error-highlight" : undefined;

    const { outer_style, inner_style } = build_design_styles(field);
    const designed_element = outer_style ? (
      <div
        key={field.id}
        style={outer_style}
        ref={(el) => {
          if (el) registerField(field.id, el);
        }}
        data-field-id={field.id}
      >
        <div style={inner_style} className={error_highlight_class}>{element}</div>
      </div>
    ) : (
      <div
        key={field.id}
        style={inner_style}
        className={error_highlight_class}
        ref={(el) => {
          if (el) registerField(field.id, el);
        }}
        data-field-id={field.id}
      >
        {element}
      </div>
    );

    return wrapField ? wrapField(designed_element, field) : designed_element;
  };

  const render_top_level_field = (field) => {
    const element = render_field(field);
    if (element === null) return null;
    return (
      <div key={field.id} className="dcs-print-avoid-break" style={{ marginBottom: get_spacing_below_px(field) }}>
        {element}
      </div>
    );
  };

  const needs_location_provider = has_location_sourced_fields(schema?.fields);

  const form_content = (
    <div className="w-full mx-auto" style={{ maxWidth: 700 }}>
      <div className="flex items-center justify-end mb-3 dcs-no-print">
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

  if (needs_location_provider) {
    return (
      <LocationDataProvider language={form_language}>
        {form_content}
      </LocationDataProvider>
    );
  }

  return form_content;
}
