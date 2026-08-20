import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DCS_FIELD_RENDERER_MAP } from "../renderer/fieldRendererMap.js";
import { DCS_FIELD_TYPE_REGISTRY } from "../fields/fieldTypes.js";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { build_design_styles } from "../renderer/designStyles.js";
import DesignableFieldWrapper from "./DesignableFieldWrapper.jsx";

/**
 * One draggable field row inside the form builder canvas: a drag handle,
 * the field's own builder-mode preview, a settings button and a delete
 * button. Group children reuse this same renderer for their own preview
 * without being individually draggable. Form design components are also
 * wrapped so they can be resized and repositioned right on the canvas.
 */
export default function BuilderFieldRow({ field, language, onOpenSettings, onOpenChildSettings, onDelete, onFieldChange, renderChildField, getFieldError }) {
  const { translate } = useDcsLanguage();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id });
  const FieldComponent = DCS_FIELD_RENDERER_MAP[field.type];
  const registry_entry = DCS_FIELD_TYPE_REGISTRY.find((entry) => entry.type === field.type);
  const is_content_field = registry_entry ? registry_entry.category === "content" : false;
  const field_error = getFieldError ? getFieldError(field.id) : null;
  const has_error = !!(field_error && field_error.messages.length > 0);

  const style = { transform: CSS.Transform.toString(transform), transition };

  if (!FieldComponent) return null;

  const field_preview = (
    <FieldComponent
      field={field}
      language={language}
      mode="builder"
      onFieldChange={onFieldChange}
      renderChildField={renderChildField}
      onOpenSettings={onOpenChildSettings}
      getFieldError={getFieldError}
    />
  );

  // Data-collection fields have their own Designs tab (background, border,
  // width, alignment) same as form-design components, but only the latter
  // go through DesignableFieldWrapper (which applies build_design_styles
  // itself, alongside its resize handles). Without this, a data field's
  // design settings were invisible while building and only ever appeared
  // once published - the canvas must show the field exactly as it will
  // render, same as designStyles.js already does for the live renderer.
  const designed_field_preview = is_content_field ? null : (() => {
    const { outer_style, inner_style } = build_design_styles(field);
    return outer_style ? (
      <div style={outer_style}>
        <div style={inner_style}>{field_preview}</div>
      </div>
    ) : (
      <div style={inner_style}>{field_preview}</div>
    );
  })();

  return (
    <div
      ref={setNodeRef}
      style={Object.assign({ position: "relative" }, style, has_error ? { backgroundColor: "rgba(231,76,60,0.05)", borderColor: "#E74C3C" } : undefined)}
      className="border p-3 bg-white flex gap-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-move flex-shrink-0 mt-1"
        aria-label="drag"
        style={{ color: "#9E9E9E" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="8" cy="6" r="1.5" />
          <circle cx="8" cy="12" r="1.5" />
          <circle cx="8" cy="18" r="1.5" />
          <circle cx="16" cy="6" r="1.5" />
          <circle cx="16" cy="12" r="1.5" />
          <circle cx="16" cy="18" r="1.5" />
        </svg>
      </button>

      <div className="flex-1 min-w-0">
        {is_content_field ? (
          <DesignableFieldWrapper field={field} onFieldChange={onFieldChange}>
            {field_preview}
          </DesignableFieldWrapper>
        ) : (
          designed_field_preview
        )}
      </div>

      <div className="flex flex-col gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={(event) => onOpenSettings(event.currentTarget.getBoundingClientRect())}
          className="cursor-pointer p-1.5 border"
          style={{ borderColor: "#E0E0E0" }}
          title={translate("DCS_SETTINGS_TITLE")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
        <button type="button" onClick={onDelete} className="cursor-pointer p-1.5 border" style={{ borderColor: "#E0E0E0" }} title={translate("DCS_BTN_DELETE")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E74C3C" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      </div>

      {has_error && (
        <div
          title={field_error.messages.join(" ")}
          className="absolute flex items-center justify-center"
          style={{ top: -8, left: -8, width: 18, height: 18, borderRadius: "50%", backgroundColor: "#E74C3C", color: "#FFFFFF", fontSize: 12, fontWeight: 700, zIndex: 2 }}
        >
          !
        </div>
      )}
    </div>
  );
}
