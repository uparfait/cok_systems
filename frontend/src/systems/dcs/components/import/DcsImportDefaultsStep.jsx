import React, { useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "@/core/contexts/ToastContext";
import DcsButtonPrimary from "../DcsButtonPrimary.jsx";
import DcsButtonOutline from "../DcsButtonOutline.jsx";
import DcsImportDefaultInput from "./DcsImportDefaultInput.jsx";
import { GEO_PARTS, header_text, required_defaults_blank, target_key } from "./importMapping.js";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const MUTED = "#9E9E9E";
const TEXT = "#333333";
const BORDER = "#E0E0E0";

export default function DcsImportDefaultsStep({ fields, headers, mapping, defaults, onDefaultsChange, onBack, onRun }) {
  const { translate } = useDcsLanguage();
  const { showError } = useToast();
  const [blank, setBlank] = useState([]);

  const field_type_label = (type) => {
    const key = `FIELD_TYPE_${String(type || "").toUpperCase()}`;
    const text = translate(key);
    return text === key ? type : text;
  };

  const mapped_text = (field) => {
    if (field.type === "geolocation") {
      const parts = GEO_PARTS.filter((part) => mapping[target_key(field.id, part)] !== undefined).map((part) => `${translate(`DCS_IMPORT_PART_${part.toUpperCase()}`)}: ${header_text(headers, mapping[target_key(field.id, part)], translate)}`);
      if (mapping[field.id] !== undefined) parts.unshift(header_text(headers, mapping[field.id], translate));
      return parts.length > 0 ? translate("DCS_IMPORT_MAPPED_TO", { name: parts.join(", ") }) : translate("DCS_IMPORT_NOT_MAPPED");
    }
    return mapping[field.id] !== undefined ? translate("DCS_IMPORT_MAPPED_TO", { name: header_text(headers, mapping[field.id], translate) }) : translate("DCS_IMPORT_NOT_MAPPED");
  };

  const choice_of = (field) => defaults[field.id] || { mode: "leave", value: "" };
  const set_mode = (field, mode) => onDefaultsChange(Object.assign({}, defaults, { [field.id]: Object.assign({}, choice_of(field), { mode }) }));
  const set_value = (field, value) => onDefaultsChange(Object.assign({}, defaults, { [field.id]: Object.assign({}, choice_of(field), { value }) }));

  const run = () => {
    const missing = required_defaults_blank(fields, defaults);
    setBlank(missing);
    if (missing.length > 0) {
      showError(translate("DCS_IMPORT_REQUIRED_EMPTY", { fields: missing.join(", ") }));
      return;
    }
    onRun();
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <p className="text-xs mb-3 flex-shrink-0" style={{ color: MUTED, ...FONT }}>
        {translate("DCS_IMPORT_EMPTY_HINT")}
      </p>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-2">
          {fields.map((field) => {
            const choice = choice_of(field);
            const is_blank_required = blank.includes(field.label);
            return (
              <div key={field.id} className="border p-3" style={{ borderColor: is_blank_required ? "#E74C3C" : BORDER }}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                  <div className="sm:w-1/3 min-w-0">
                    <p className={`text-sm font-semibold truncate ${field.required ? "cok-req" : ""}`} style={{ color: TEXT, ...FONT }} title={field.label}>
                      {field.label}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: MUTED, ...FONT }}>
                      {field_type_label(field.type)} - {mapped_text(field)}
                    </p>
                  </div>
                  <div className="sm:w-1/4 min-w-0">
                    <select value={choice.mode} onChange={(event) => set_mode(field, event.target.value)} className="cok-auth-input w-full cursor-pointer" style={{ paddingLeft: 14, ...FONT }}>
                      <option value="leave">{translate("DCS_IMPORT_EMPTY_LEAVE")}</option>
                      <option value="use">{translate("DCS_IMPORT_EMPTY_USE")}</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-0">{choice.mode === "use" ? <DcsImportDefaultInput field={field} value={choice.value} onChange={(value) => set_value(field, value)} /> : null}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t" style={{ borderColor: BORDER }}>
        <p className="text-xs min-w-0 flex-1" style={{ color: "#E74C3C", ...FONT }}>
          {blank.length > 0 ? translate("DCS_IMPORT_REQUIRED_EMPTY", { fields: blank.join(", ") }) : ""}
        </p>
        <div className="flex gap-2">
          <DcsButtonOutline onClick={onBack}>{translate("DCS_BTN_BACK")}</DcsButtonOutline>
          <DcsButtonPrimary onClick={run}>{translate("DCS_IMPORT_RUN_BTN")}</DcsButtonPrimary>
        </div>
      </div>
    </div>
  );
}
