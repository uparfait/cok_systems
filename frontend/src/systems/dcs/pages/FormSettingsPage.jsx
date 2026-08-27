import React, { useState, useRef, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { update_form } from "../services/formsService.js";
import DcFormBuilderSection from "../builder/DcFormBuilderSection.jsx";
import ApprovalFlowSection, { is_approval_config_complete } from "../builder/ApprovalFlowSection.jsx";
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
  const [approval_config, setApprovalConfig] = useState(form.approval_config || null);
  const [publishing, setPublishing] = useState(false);
  const [schema_errors, setSchemaErrors] = useState([]);
  const loaded_form_id_ref = useRef(form._id);

  // A field's position in the backend's error paths (fields[2], etc.) is
  // positional, not id-based - any edit (reorder, add, delete, or a drawer
  // save) can shift what those indices point to, so stale errors are
  // cleared on every change rather than risk highlighting the wrong field.
  // They come back, freshly resolved, on the next failed publish attempt.
  const handle_fields_change = (next_fields) => {
    setSchemaErrors([]);
    setFields(next_fields);
  };

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
    setApprovalConfig(form.approval_config || null);
  }, [form]);

  const public_link = `${window.location.origin}/dcs-form/${form_group_id}`;

  const copy_link = () => {
    window.navigator.clipboard.writeText(public_link);
    showSuccess(translate("DCS_TOAST_LINK_COPIED"));
  };

  const handle_publish = async (schema) => {
    if (!is_approval_config_complete(approval_config)) {
      showError(translate("DCS_APPROVAL_CONFIG_INCOMPLETE"));
      return false;
    }
    setPublishing(true);
    try {
      const response = await update_form(form_group_id, form_name, schema, approval_config);
      setSchemaErrors([]);
      showSuccess(response.message || translate("DCS_TOAST_FORM_PUBLISHED"));
      refreshForm();
      return true;
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
      setSchemaErrors(Array.isArray(error.errors) ? error.errors : []);
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
        <DcFormBuilderSection
          fields={fields}
          onFieldsChange={handle_fields_change}
          onPublish={handle_publish}
          publishing={publishing}
          schemaErrors={schema_errors}
        />
        <ApprovalFlowSection value={approval_config} onChange={setApprovalConfig} />
      </div>
    </div>
  );
}
