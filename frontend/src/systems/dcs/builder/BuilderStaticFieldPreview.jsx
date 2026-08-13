import React from "react";
import { DCS_FIELD_RENDERER_MAP } from "../renderer/fieldRendererMap.js";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

/**
 * Renders a field that lives inside a group (not individually draggable at
 * the top level) with just a settings trigger, reusing the exact same
 * field components as everywhere else in the system.
 */
export default function BuilderStaticFieldPreview({ field, language, onOpenSettings }) {
  const { translate } = useDcsLanguage();
  const FieldComponent = DCS_FIELD_RENDERER_MAP[field.type];
  if (!FieldComponent) return null;

  return (
    <div className="border p-2 flex gap-2" style={{ borderColor: "#E0E0E0" }}>
      <div className="flex-1 min-w-0">
        <FieldComponent
          field={field}
          language={language}
          mode="builder"
          renderChildField={(child_field) => (
            <BuilderStaticFieldPreview field={child_field} language={language} onOpenSettings={onOpenSettings} />
          )}
        />
      </div>
      <button
        type="button"
        onClick={() => onOpenSettings(field)}
        className="cursor-pointer p-1.5 border flex-shrink-0 self-start"
        style={{ borderColor: "#E0E0E0" }}
        title={translate("DCS_SETTINGS_TITLE")}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
    </div>
  );
}
