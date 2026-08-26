import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_field_text } from "../fields/fieldText.js";
import { DCS_FIELD_TYPE_REGISTRY } from "../fields/fieldTypes.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";

/**
 * Shown after a template is picked from AddComponentPanel's "Templates"
 * group: every one of the template's top-level fields, with a checkbox so
 * the author can drop the ones they don't want, then a choice of adding
 * the selected fields alongside whatever's already on the canvas or
 * overwriting the canvas with just them. A checked group/section always
 * brings its own children along as part of that same field.
 */
export default function TemplateFieldPickerOverlay({ template, onClose, onConfirm }) {
  const { translate, language } = useDcsLanguage();
  const fields = template.fields || [];
  const [selected_ids, setSelectedIds] = useState(() => new Set(fields.map((field) => field.id)));

  const type_label = (field_type) => {
    const entry = DCS_FIELD_TYPE_REGISTRY.find((candidate) => candidate.type === field_type);
    return entry ? translate(entry.labelKey) : field_type;
  };

  const toggle_field = (field_id) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(field_id)) {
        next.delete(field_id);
      } else {
        next.add(field_id);
      }
      return next;
    });
  };

  const selected_fields = fields.filter((field) => selected_ids.has(field.id));

  const handle_confirm = (mode) => {
    if (selected_fields.length === 0) return;
    onConfirm(selected_fields, mode);
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-start justify-center pt-10 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border-2 w-full flex flex-col" style={{ borderColor: "#E0E0E0", minWidth: "50vw", maxWidth: 900, maxHeight: "80vh" }}>
        <div className="flex items-center justify-between px-3 py-3 border-b flex-shrink-0" style={{ borderColor: "#E0E0E0" }}>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
              {template.name}
            </p>
            {template.description && (
              <p className="text-xs truncate" style={{ color: "#9E9E9E" }}>
                {template.description}
              </p>
            )}
          </div>
          <DcsButtonOutline onClick={onClose}>{translate("DCS_BTN_CLOSE")}</DcsButtonOutline>
        </div>

        <div className="overflow-y-auto flex-1 px-3 py-2">
          {fields.length === 0 ? (
            <p className="text-xs py-6 text-center" style={{ color: "#9E9E9E" }}>
              {translate("DCS_TEMPLATE_PICKER_EMPTY")}
            </p>
          ) : (
            fields.map((field) => (
              <label key={field.id} className="w-full flex items-center gap-3 px-1 py-2 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={selected_ids.has(field.id)} onChange={() => toggle_field(field.id)} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium" style={{ color: "#333333" }}>
                    {get_field_text(field.label, language) || type_label(field.type)}
                  </span>
                  <span className="block text-xs" style={{ color: "#9E9E9E" }}>
                    {type_label(field.type)}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>

        <div className="flex flex-col gap-2 px-3 py-3 border-t flex-shrink-0" style={{ borderColor: "#E0E0E0" }}>
          <p className="text-xs" style={{ color: "#9E9E9E" }}>
            {translate("DCS_TEMPLATE_PICKER_HINT", { count: selected_fields.length })}
          </p>
          <div className="flex flex-col min-[500px]:flex-row gap-2">
            <DcsButtonOutline className="flex-1" onClick={() => handle_confirm("add")} disabled={selected_fields.length === 0}>
              {translate("DCS_BTN_TEMPLATE_ADD")}
            </DcsButtonOutline>
            <DcsButtonPrimary className="flex-1" onClick={() => handle_confirm("overwrite")} disabled={selected_fields.length === 0}>
              {translate("DCS_BTN_TEMPLATE_OVERWRITE")}
            </DcsButtonPrimary>
          </div>
        </div>
      </div>
    </div>
  );
}
