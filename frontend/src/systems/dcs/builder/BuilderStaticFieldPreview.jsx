import React from "react";
import { DCS_FIELD_RENDERER_MAP } from "../renderer/fieldRendererMap.js";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { build_design_styles } from "../renderer/designStyles.js";

/**
 * Renders a field that lives inside a group (not individually draggable at
 * the top level) with just a settings trigger, reusing the exact same
 * field components as everywhere else in the system.
 */
export default function BuilderStaticFieldPreview({ field, language, onOpenSettings, getFieldError }) {
  const { translate } = useDcsLanguage();
  const FieldComponent = DCS_FIELD_RENDERER_MAP[field.type];
  if (!FieldComponent) return null;

  const field_error = getFieldError ? getFieldError(field.id) : null;
  const has_error = !!(field_error && field_error.messages.length > 0);

  const field_preview = (
    <FieldComponent
      field={field}
      language={language}
      mode="builder"
      getFieldError={getFieldError}
      renderChildField={(child_field) => (
        <BuilderStaticFieldPreview field={child_field} language={language} onOpenSettings={onOpenSettings} getFieldError={getFieldError} />
      )}
    />
  );
  const { outer_style, inner_style } = build_design_styles(field);
  const designed_field_preview = outer_style ? (
    <div style={outer_style}>
      <div style={inner_style}>{field_preview}</div>
    </div>
  ) : (
    <div style={inner_style}>{field_preview}</div>
  );

  return (
    <div
      className="border p-2 flex gap-2"
      style={Object.assign({ position: "relative", borderColor: "#E0E0E0" }, has_error ? { backgroundColor: "rgba(231,76,60,0.05)", borderColor: "#E74C3C" } : undefined)}
    >
      <div className="flex-1 min-w-0">{designed_field_preview}</div>
      <button
        type="button"
        onClick={(event) => onOpenSettings(field, event.currentTarget.getBoundingClientRect())}
        className="cursor-pointer p-1.5 border flex-shrink-0 self-start"
        style={{ borderColor: "#E0E0E0" }}
        title={translate("DCS_SETTINGS_TITLE")}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>

      {has_error && (
        <div
          title={field_error.messages.join(" ")}
          className="absolute flex items-center justify-center"
          style={{ top: -6, left: -6, width: 15, height: 15, borderRadius: "50%", backgroundColor: "#E74C3C", color: "#FFFFFF", fontSize: 10, fontWeight: 700, zIndex: 2 }}
        >
          !
        </div>
      )}
    </div>
  );
}
