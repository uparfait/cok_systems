import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import FormBuilderCanvas from "./FormBuilderCanvas.jsx";
import FieldSettingsDrawer from "./FieldSettingsDrawer.jsx";
import ReviewOverlay from "../renderer/ReviewOverlay.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";

/**
 * Section two of project creation: the DC form builder itself - add
 * components, configure them, review the live renderer, then publish.
 */
export default function DcFormBuilderSection({ fields, onFieldsChange, onPublish, publishing }) {
  const { translate } = useDcsLanguage();
  const [selected_field, setSelectedField] = useState(null);
  const [settings_anchor_rect, setSettingsAnchorRect] = useState(null);
  const [is_reviewing, setIsReviewing] = useState(false);

  const all_flat_fields = flatten_fields(fields);

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

  return (
    <div className="space-y-4">
      <FormBuilderCanvas fields={fields} onFieldsChange={onFieldsChange} onOpenSettings={handle_open_settings} />

      {fields.length > 0 && (
        <DcsButtonOutline className="w-full" onClick={() => setIsReviewing(true)}>
          {translate("DCS_BTN_REVIEW")}
        </DcsButtonOutline>
      )}

      {selected_field && (
        <FieldSettingsDrawer
          field={selected_field}
          allFields={all_flat_fields}
          anchorRect={settings_anchor_rect}
          onSave={handle_settings_save}
          onClose={handle_close_settings}
        />
      )}

      {is_reviewing && (
        <ReviewOverlay
          schema={schema}
          publishing={publishing}
          onClose={() => setIsReviewing(false)}
          onPublish={async () => {
            const did_succeed = await onPublish(schema);
            if (did_succeed) setIsReviewing(false);
          }}
        />
      )}
    </div>
  );
}
