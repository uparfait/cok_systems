import React, { useState, useRef, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { update_form, get_form_field_options, transfer_form_ownership } from "../services/formsService.js";
import DcsOwnershipTransfer from "../components/DcsOwnershipTransfer.jsx";
import { useLazyFieldResolvers } from "../hooks/useLazyFieldResolvers.js";
import DcFormBuilderSection from "../builder/DcFormBuilderSection.jsx";
import { is_approval_config_complete } from "../builder/ApprovalFlowSection.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsFormNameField from "../components/DcsFormNameField.jsx";
import { validate_form_schema } from "../builder/validateSchema.js";

export default function FormSettingsPage() {
  const { form_group_id, form, refreshForm } = useOutletContext();
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [fields, setFields] = useState(form.schema.fields);
  const [form_name, setFormName] = useState(form.form_name || "");
  const [approval_config, setApprovalConfig] = useState(form.approval_config || null);
  const [publishing, setPublishing] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [schema_errors, setSchemaErrors] = useState([]);
  const loaded_form_id_ref = useRef(form._id);
  const { resolveFieldOptions, resolveFullFieldOptions } = useLazyFieldResolvers("form", form_group_id, get_form_field_options);

  const handle_fields_change = (next_fields) => {
    setSchemaErrors([]);
    setFields(next_fields);
  };

  useEffect(() => {
    if (form._id === loaded_form_id_ref.current) return;
    loaded_form_id_ref.current = form._id;
    setFields(form.schema.fields);
    setFormName(form.form_name || "");
    setApprovalConfig(form.approval_config || null);
  }, [form]);

  const public_link = `${window.location.origin}/dcs-form/${form_group_id}`;

  const handle_transfer = async (user) => {
    setTransferring(true);
    try {
      await transfer_form_ownership(form_group_id, user.user_id);
      showSuccess(translate("DCS_TOAST_OWNERSHIP_TRANSFERRED", { name: user.full_name || user.email }));
      refreshForm();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setTransferring(false);
    }
  };

  const copy_link = () => {
    window.navigator.clipboard.writeText(public_link);
    showSuccess(translate("DCS_TOAST_LINK_COPIED"));
  };

  const handle_publish = async (schema) => {
    const frontend_check = validate_form_schema(schema);
    if (!frontend_check.valid) {
      setSchemaErrors(frontend_check.errors);
      showError(translate("DCS_SCHEMA_ERROR_BANNER"));
      return false;
    }

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

      {form.viewer_can_transfer === true && (
        <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: "#E0E0E0" }}>
          <DcsOwnershipTransfer ownerName={form.owner_name} onTransfer={handle_transfer} transferring={transferring} />
        </div>
      )}

      <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: "#E0E0E0" }}>
        <DcsFormNameField value={form_name} onChange={setFormName} />
        <DcFormBuilderSection
          fields={fields}
          onFieldsChange={handle_fields_change}
          onPublish={handle_publish}
          publishing={publishing}
          schemaErrors={schema_errors}
          resolveFieldOptions={resolveFieldOptions}
          resolveFullFieldOptions={resolveFullFieldOptions}
        />
      </div>
    </div>
  );
}
