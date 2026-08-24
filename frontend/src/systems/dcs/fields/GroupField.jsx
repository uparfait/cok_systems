import React from "react";
import { get_field_text } from "./fieldText.js";
import { get_spacing_below_px } from "../renderer/designStyles.js";
import { DCS_FIELD_RENDERER_MAP } from "../renderer/fieldRendererMap.js";
import { create_blank_field } from "./fieldTypes.js";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import AddComponentPanel from "../builder/AddComponentPanel.jsx";
import { collect_uploaded_file_urls } from "../builder/collectUploadedFileUrls.js";
import { delete_design_file } from "../services/designUploadService.js";

/**
 * Organizes related fields visually together. In the builder, each child
 * gets its own live preview plus settings/delete controls, and an "Add
 * field" trigger below the list opens the very same "Choose a component to
 * add" picker the main canvas uses - previously the only way to populate a
 * group's children was the JSON import overlay. The live renderer (and the
 * read-only review) instead delegates each child to renderChildField,
 * exactly as before.
 */
export default function GroupField({ field, language, mode, onFieldChange, onOpenSettings, renderChildField, getFieldError, autoOpenAddMenu }) {
  const { translate } = useDcsLanguage();
  const is_builder = mode === "builder";
  const label = get_field_text(field.label, language);
  const children = field.children || [];

  if (!is_builder) {
    return (
      <div className="w-full border p-3" style={{ borderColor: "#E0E0E0" }}>
        {label && (
          <p className="text-sm font-semibold mb-3" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
            {label}
          </p>
        )}
        <div>
          {children.map((child_field) => (
            <div key={child_field.id} style={{ marginBottom: get_spacing_below_px(child_field) }}>
              {renderChildField && renderChildField(child_field)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const update_children = (next_children) => {
    onFieldChange && onFieldChange(Object.assign({}, field, { children: next_children }));
  };

  const handle_add_child = (field_type) => {
    update_children(children.concat([create_blank_field(field_type)]));
  };

  const handle_child_field_change = (child_id, updated_child) => {
    update_children(children.map((child) => (child.id === child_id ? updated_child : child)));
  };

  const handle_delete_child = (child_id) => {
    const removed_child = children.find((child) => child.id === child_id);
    update_children(children.filter((child) => child.id !== child_id));
    collect_uploaded_file_urls(removed_child).forEach((url) => delete_design_file(url));
  };

  return (
    <div className="w-full border p-3" style={{ borderColor: "#E0E0E0" }}>
      {label && (
        <p className="text-sm font-semibold mb-3" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
          {label}
        </p>
      )}

      <div className="space-y-2">
        {children.map((child) => {
          const ChildComponent = DCS_FIELD_RENDERER_MAP[child.type];
          if (!ChildComponent) return null;
          const child_error = getFieldError ? getFieldError(child.id) : null;
          const child_has_error = !!(child_error && child_error.messages.length > 0);
          return (
            <div
              key={child.id}
              className="border p-2 flex gap-2"
              style={{
                position: "relative",
                borderColor: child_has_error ? "#E74C3C" : "#E0E0E0",
                backgroundColor: child_has_error ? "rgba(231,76,60,0.05)" : undefined,
              }}
            >
              <div className="flex-1 min-w-0">
                <ChildComponent
                  field={child}
                  language={language}
                  mode="builder"
                  onFieldChange={(updated_child) => handle_child_field_change(child.id, updated_child)}
                />
              </div>
              {child_has_error && (
                <div
                  title={child_error.messages.join(" ")}
                  className="absolute flex items-center justify-center"
                  style={{ top: -6, left: -6, width: 15, height: 15, borderRadius: "50%", backgroundColor: "#E74C3C", color: "#FFFFFF", fontSize: 10, fontWeight: 700, zIndex: 2 }}
                >
                  !
                </div>
              )}
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={(event) => onOpenSettings && onOpenSettings(child, event.currentTarget.getBoundingClientRect())}
                  className="cursor-pointer p-1.5 border"
                  style={{ borderColor: "#E0E0E0" }}
                  title={translate("DCS_SETTINGS_TITLE")}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handle_delete_child(child.id)}
                  className="cursor-pointer p-1.5 border"
                  style={{ borderColor: "#E0E0E0" }}
                  title={translate("DCS_BTN_DELETE")}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E74C3C" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <AddComponentPanel
        onSelect={handle_add_child}
        initialOpen={autoOpenAddMenu}
        renderTrigger={(open) => (
          <>
            {children.length === 0 && (
              <button
                type="button"
                onClick={open}
                className="w-full cursor-pointer text-xs text-center px-4 py-6"
                style={{ color: "#9E9E9E", background: "none", border: "none" }}
              >
                {translate("DCS_GROUP_EMPTY_HINT")}
              </button>
            )}
            <DcsButtonOutline className="w-full mt-2" onClick={open}>
              {translate("DCS_GROUP_ADD_FIELD")}
            </DcsButtonOutline>
          </>
        )}
      />
    </div>
  );
}
