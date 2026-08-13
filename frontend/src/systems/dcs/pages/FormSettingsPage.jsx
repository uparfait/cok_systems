import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { update_form } from "../services/formsService.js";
import DcFormBuilderSection from "../builder/DcFormBuilderSection.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsFormNameField from "../components/DcsFormNameField.jsx";

/**
 * Editing a form never overwrites it - publishing here always creates the
 * next immutable version (v1, v2, v3, ...).
 */
export default function FormSettingsPage() {
  const { form_group_id, form, refreshForm } = useOutletContext();
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [fields, setFields] = useState(form.schema.fields);
  const [form_name, setFormName] = useState(form.form_name || "");
  const [publishing, setPublishing] = useState(false);

  const public_link = `${window.location.origin}/dcs-form/${form_group_id}`;

  const copy_link = () => {
    window.navigator.clipboard.writeText(public_link);
    showSuccess(translate("DCS_TOAST_LINK_COPIED"));
  };

  const handle_publish = async (schema) => {
    setPublishing(true);
    try {
      await update_form(form_group_id, form_name, schema);
      showSuccess(translate("DCS_TOAST_FORM_PUBLISHED"));
      refreshForm();
      return true;
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
      return false;
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4 pb-16">
      <div className="bg-white border-2 p-4 sm:p-6 flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "#E0E0E0" }}>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_FORM_PUBLIC_LINK_LABEL")}
          </p>
          <p className="truncate text-sm" style={{ color: "#056daa" }} title={public_link}>
            {public_link}
          </p>
        </div>
        <DcsButtonOutline onClick={copy_link}>{translate("DCS_FORM_COPY_LINK")}</DcsButtonOutline>
      </div>

      <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: "#E0E0E0" }}>
        <DcsFormNameField value={form_name} onChange={setFormName} />
        <DcFormBuilderSection fields={fields} onFieldsChange={setFields} onPublish={handle_publish} publishing={publishing} />
      </div>
    </div>
  );
}
