import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { build_schema_error_index, get_field_error_entry } from "./schemaErrorParser.js";
import { validate_form_schema } from "./validateSchema.js";
import FormBuilderCanvas from "./FormBuilderCanvas.jsx";
import FieldSettingsDrawer from "./FieldSettingsDrawer.jsx";
import ReviewOverlay from "../renderer/ReviewOverlay.jsx";
import DcsFormCodeOverlay from "./DcsFormCodeOverlay.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import { DesignUploadProvider, useDesignUpload } from "./DesignUploadContext.jsx";

/**
 * Section two of project creation: the DC form builder itself - add
 * components, configure them, review the live renderer, then publish.
 */
export default function DcFormBuilderSection(props) {
  return (
    <DesignUploadProvider>
      <DcFormBuilderSectionInner {...props} />
    </DesignUploadProvider>
  );
}

function DcFormBuilderSectionInner({ fields, onFieldsChange, onPublish, publishing, schemaErrors, publishLabelKey, resolveFieldOptions, resolveFullFieldOptions, onValidationChange }) {
  const { translate } = useDcsLanguage();
  const { is_uploading, average_percent } = useDesignUpload();
  const [selected_field, setSelectedField] = useState(null);
  const [settings_anchor_rect, setSettingsAnchorRect] = useState(null);
  const [is_reviewing, setIsReviewing] = useState(false);
  const [is_code_overlay_open, setIsCodeOverlayOpen] = useState(false);

  const all_flat_fields = flatten_fields(fields);

  const frontend_validation = useMemo(
    () => validate_form_schema({ fields }),
    [fields],
  );

  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(frontend_validation);
    }
  }, [frontend_validation, onValidationChange]);

  const combined_errors = useMemo(() => {
    const backend_errors = Array.isArray(schemaErrors) ? schemaErrors : [];
    const frontend_errors = Array.isArray(frontend_validation.errors) ? frontend_validation.errors : [];
    const seen = new Set();
    const combined = [];
    for (const error of [...frontend_errors, ...backend_errors]) {
      const key = `${error.path}:${error.reason}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(error);
      }
    }
    return combined;
  }, [schemaErrors, frontend_validation]);

  const schema_error_index = useMemo(
    () => build_schema_error_index(combined_errors, fields, translate),
    [combined_errors, fields, translate],
  );
  const get_field_error = (field_id) => get_field_error_entry(schema_error_index, field_id);
  const selected_field_error = selected_field ? get_field_error(selected_field.id) : null;

  useEffect(() => {
    const handle_keydown = (event) => {
      if (event.ctrlKey && event.key === "6") {
        event.preventDefault();
        setIsCodeOverlayOpen(true);
      }
    };
    document.addEventListener("keydown", handle_keydown);
    return () => document.removeEventListener("keydown", handle_keydown);
  }, []);

  const handle_open_settings = (field, rect) => {
    setSelectedField(field);
    setSettingsAnchorRect(rect || null);
  };

  const handle_settings_save = (updated_field) => {
    const update_recursive = (field_list) =>
      field_list.map((field) => {
        if (field.id === updated_field.id) return updated_field;
        if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
          return Object.assign({}, field, { children: update_recursive(field.children) });
        }
        return field;
      });
    onFieldsChange(update_recursive(fields));
    setSelectedField(null);
    setSettingsAnchorRect(null);
  };

  const handle_close_settings = () => {
    setSelectedField(null);
    setSettingsAnchorRect(null);
  };

  const schema = { fields };
  const has_validation_errors = combined_errors.length > 0;

  const handle_publish_click = useCallback(async () => {
    if (has_validation_errors) {
      return false;
    }
    if (onPublish) {
      return await onPublish(schema);
    }
    return false;
  }, [has_validation_errors, onPublish, schema]);

  return (
    <div className="space-y-4">
      {has_validation_errors && (
        <div className="text-sm px-3 py-2 rounded-none" style={{ backgroundColor: "rgba(231,76,60,0.1)", color: "#E74C3C", fontFamily: "'Montserrat', sans-serif" }}>
          <div className="font-semibold mb-1">{translate("DCS_SCHEMA_ERROR_BANNER")}</div>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {combined_errors.slice(0, 10).map((error, idx) => (
              <li key={idx}>{translate(`DCS_SCHEMA_ERROR_${error.reason?.toUpperCase?.() || "UNKNOWN"}`)}</li>
            ))}
            {combined_errors.length > 10 && (
              <li>+ {combined_errors.length - 10} {translate("DCS_SCHEMA_ERROR_MORE_COUNT")}</li>
            )}
          </ul>
        </div>
      )}

      <FormBuilderCanvas fields={fields} onFieldsChange={onFieldsChange} onOpenSettings={handle_open_settings} getFieldError={get_field_error} />

      {fields.length > 0 && (
        <DcsButtonOutline
          className="w-full"
          onClick={() => {
            if (!has_validation_errors) {
              setIsReviewing(true);
            }
          }}
          disabled={is_uploading || has_validation_errors}
        >
          {is_uploading ? translate("DCS_DESIGN_UPLOADING_PERCENT", { percent: average_percent }) : translate("DCS_BTN_REVIEW")}
        </DcsButtonOutline>
      )}

      {selected_field && (
        <FieldSettingsDrawer
          field={selected_field}
          allFields={all_flat_fields}
          anchorRect={settings_anchor_rect}
          onSave={handle_settings_save}
          onClose={handle_close_settings}
          fieldErrorInfo={selected_field_error}
          resolveFullFieldOptions={resolveFullFieldOptions}
        />
      )}

      {is_reviewing && (
        <ReviewOverlay
          schema={schema}
          publishing={publishing}
          uploadingFiles={is_uploading}
          uploadPercent={average_percent}
          publishLabelKey={publishLabelKey}
          resolveFieldOptions={resolveFieldOptions}
          onClose={() => setIsReviewing(false)}
          onPublish={async () => {
            const did_succeed = await handle_publish_click();
            if (did_succeed) setIsReviewing(false);
          }}
        />
      )}

      {is_code_overlay_open && (
        <DcsFormCodeOverlay
          fields={fields}
          allFields={all_flat_fields}
          onCreateForm={(next_fields, mode) => onFieldsChange(mode === "add" ? fields.concat(next_fields) : next_fields)}
          onClose={() => setIsCodeOverlayOpen(false)}
        />
      )}
    </div>
  );
}
