import React, { useState, useRef, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { update_form } from "../services/formsService.js";
import DcFormBuilderSection from "../builder/DcFormBuilderSection.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsFormNameField from "../components/DcsFormNameField.jsx";

/**
 * Editing a form always starts from its currently active version - a
 * change only mints a brand new, immutable version when a data-collection
 * field was added or removed; any other edit (condition, design, content
 * component, label) updates that same active version in place.
 */
export default function FormSettingsPage() {
  const { form_group_id, form, refreshForm } = useOutletContext();
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [fields, setFields] = useState(form.schema.fields);
  const [form_name, setFormName] = useState(form.form_name || "");
  const [publishing, setPublishing] = useState(false);
  const loaded_form_id_ref = useRef(form._id);

  // The shell's own `form` can change underneath this page - after
  // clicking the Settings tab forces a fresh reload, or after a different
  // version was activated elsewhere - and must actually be picked up, not
  // just used once at first mount. Only resyncs when the loaded document
  // itself changed (a different _id), never on every background poll of
  // the same still-active version, so it never stomps on an edit in
  // progress.
  useEffect(() => {
    if (form._id === loaded_form_id_ref.current) return;
    loaded_form_id_ref.current = form._id;
    setFields(form.schema.fields);
    setFormName(form.form_name || "");
  }, [form]);

  const public_link = `${window.location.origin}/dcs-form/${form_group_id}`;

  const copy_link = () => {
    window.navigator.clipboard.writeText(public_link);
    showSuccess(translate("DCS_TOAST_LINK_COPIED"));
  };

  const handle_publish = async (schema) => {
    setPublishing(true);
    try {
      const response = await update_form(form_group_id, form_name, schema);
      showSuccess(response.message || translate("DCS_TOAST_FORM_PUBLISHED"));
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
