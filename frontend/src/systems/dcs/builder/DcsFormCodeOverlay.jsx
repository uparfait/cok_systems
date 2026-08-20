import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { DCS_FIELD_TYPE_REGISTRY } from "../fields/fieldTypes.js";
import { get_field_text } from "../fields/fieldText.js";
import { build_form_creation_guide } from "./formSpecCatalog.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsButtonOutlineReverse from "../components/DcsButtonOutlineReverse.jsx";

/**
 * Reads either { fields: [...] } or a bare [...] as the pasted payload, so
 * a form copied from "Copy created form" and a bare fields array an author
 * might hand-author both work the same way.
 */
function parse_pasted_fields(raw_text) {
  const parsed = JSON.parse(raw_text);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.fields)) return parsed.fields;
  throw new Error("not_a_field_array");
}

/**
 * Summarizes one field's own validation rules as a short, human-readable
 * line - not the full rule objects, just enough for an author to recognize
 * what is already enforced without opening its settings drawer.
 */
function summarize_rules(field) {
  const rules = field.validation_rules || [];
  if (rules.length === 0) return "-";
  return rules.map((rule) => (rule.value !== undefined && rule.value !== "" ? `${rule.operator}(${rule.value})` : rule.operator)).join(", ");
}

/**
 * Ctrl+6 overlay: a live table of every component already on the canvas
 * (with its validations, for quick review/copying), a paste box to bring
 * in a form authored elsewhere, and the three actions that make the two
 * directions actually useful together - copy the schema documentation out
 * to an external AI, create a form from what it hands back, and copy the
 * form just built back out again for safekeeping or reuse.
 */
export default function DcsFormCodeOverlay({ fields, allFields, onCreateForm, onClose }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [pasted_code, setPastedCode] = useState("");
  const [parse_error, setParseError] = useState("");

  const type_label = (field_type) => {
    const entry = DCS_FIELD_TYPE_REGISTRY.find((candidate) => candidate.type === field_type);
    return entry ? translate(entry.labelKey) : field_type;
  };

  const handle_copy_creation_rules = () => {
    const guide_json = JSON.stringify(build_form_creation_guide(), null, 2);
    window.navigator.clipboard.writeText(guide_json);
    showSuccess(translate("DCS_TOAST_CREATION_RULES_COPIED"));
  };

  const handle_copy_created_form = () => {
    window.navigator.clipboard.writeText(JSON.stringify({ fields }, null, 2));
    showSuccess(translate("DCS_TOAST_FORM_JSON_COPIED"));
  };

  const handle_create_form = () => {
    setParseError("");
    try {
      const next_fields = parse_pasted_fields(pasted_code);
      onCreateForm(next_fields);
      showSuccess(translate("DCS_TOAST_FORM_CREATED_FROM_CODE"));
    } catch (error) {
      setParseError(translate("DCS_ERROR_INVALID_FORM_CODE"));
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col" style={{ backgroundColor: "#F7F9FB" }}>
      <div className="cok-bg-primary px-4 py-3 flex items-center justify-between flex-shrink-0">
        <span className="text-white font-semibold uppercase tracking-wide text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          {translate("DCS_CODE_OVERLAY_TITLE")}
        </span>
        <DcsButtonOutlineReverse onClick={onClose}>{translate("DCS_BTN_CLOSE")}</DcsButtonOutlineReverse>
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-[700px]:p-6">
        <div className="w-full min-[900px]:max-w-[860px] mx-auto space-y-6">
          <div className="bg-white border-2 p-4" style={{ borderColor: "#E0E0E0" }}>
            <p className="text-sm font-semibold mb-3" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
              {translate("DCS_CODE_OVERLAY_CURRENT_FIELDS_TITLE")}
            </p>
            {allFields.length === 0 ? (
              <p className="text-xs" style={{ color: "#9E9E9E" }}>{translate("DCS_CODE_OVERLAY_NO_FIELDS")}</p>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#F7F9FB" }}>
                      <th className="text-left p-2 border" style={{ borderColor: "#E0E0E0" }}>{translate("DCS_CODE_OVERLAY_TABLE_TYPE")}</th>
                      <th className="text-left p-2 border" style={{ borderColor: "#E0E0E0" }}>{translate("DCS_CODE_OVERLAY_TABLE_LABEL")}</th>
                      <th className="text-left p-2 border" style={{ borderColor: "#E0E0E0" }}>{translate("DCS_CODE_OVERLAY_TABLE_MANDATORY")}</th>
                      <th className="text-left p-2 border" style={{ borderColor: "#E0E0E0" }}>{translate("DCS_CODE_OVERLAY_TABLE_VALIDATIONS")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allFields.map((field) => (
                      <tr key={field.id}>
                        <td className="p-2 border align-top" style={{ borderColor: "#E0E0E0", color: "#333333" }}>{type_label(field.type)}</td>
                        <td className="p-2 border align-top" style={{ borderColor: "#E0E0E0", color: "#333333" }}>{get_field_text(field.label, "en") || field.id}</td>
                        <td className="p-2 border align-top" style={{ borderColor: "#E0E0E0", color: "#333333" }}>
                          {field.mandatory ? translate("DCS_SETTINGS_YES") : translate("DCS_SETTINGS_NO")}
                        </td>
                        <td className="p-2 border align-top" style={{ borderColor: "#E0E0E0", color: "#555555" }}>{summarize_rules(field)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border-2 p-4 space-y-3" style={{ borderColor: "#E0E0E0" }}>
            <label className="cok-auth-label">{translate("DCS_CODE_OVERLAY_PASTE_LABEL")}</label>
            <textarea
              className="cok-auth-input w-full py-2"
              rows={10}
              style={{ fontFamily: "monospace", fontSize: 12 }}
              placeholder={translate("DCS_CODE_OVERLAY_PASTE_PLACEHOLDER")}
              value={pasted_code}
              onChange={(event) => setPastedCode(event.target.value)}
            />
            {parse_error && (
              <p className="text-xs" style={{ color: "#E74C3C" }}>{parse_error}</p>
            )}
            <p className="text-xs" style={{ color: "#9E9E9E" }}>{translate("DCS_CODE_OVERLAY_REPLACE_WARNING")}</p>

            <div className="flex flex-col min-[700px]:flex-row gap-3 pt-1">
              <DcsButtonOutline className="flex-1" onClick={handle_copy_creation_rules}>
                {translate("DCS_BTN_COPY_CREATION_RULES")}
              </DcsButtonOutline>
              <DcsButtonPrimary className="flex-1" onClick={handle_create_form} disabled={!pasted_code.trim()}>
                {translate("DCS_BTN_CREATE_FORM")}
              </DcsButtonPrimary>
              <DcsButtonOutline className="flex-1" onClick={handle_copy_created_form}>
                {translate("DCS_BTN_COPY_CREATED_FORM")}
              </DcsButtonOutline>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
