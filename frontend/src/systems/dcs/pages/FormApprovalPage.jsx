import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { update_form, get_form_field_options } from "../services/formsService.js";
import { useLazyFieldResolvers } from "../hooks/useLazyFieldResolvers.js";
import ApprovalFlowSection from "../builder/ApprovalFlowSection.jsx";
import { validate_form_schema } from "../builder/validateSchema.js";

export default function FormApprovalPage() {
  const { form_group_id, form, refreshForm } = useOutletContext();
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [approval_config, setApprovalConfig] = useState(form.approval_config || null);
  const [schema_errors, setSchemaErrors] = useState([]);
  const { resolveFullFieldOptions } = useLazyFieldResolvers("form", form_group_id, get_form_field_options);

  useEffect(() => {
    setApprovalConfig(form.approval_config || null);
  }, [form]);

  const handle_save_approvers = async (config) => {
    const frontend_check = validate_form_schema({ fields: form.schema.fields });
    if (!frontend_check.valid) {
      setSchemaErrors(frontend_check.errors);
      showError(translate("DCS_SCHEMA_ERROR_BANNER"));
      return;
    }
    try {
      const response = await update_form(form_group_id, form.form_name || "", { fields: form.schema.fields }, config);
      showSuccess(response.message || translate("DCS_APPROVAL_SAVED"));
      refreshForm();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    }
  };

  return (
    <div className="space-y-4 pb-16 w-full">
      <div className="bg-white border-2 p-4 sm:p-6 w-full" style={{ borderColor: "#E0E0E0" }}>
        <ApprovalFlowSection
          value={approval_config}
          onChange={setApprovalConfig}
          fields={form.schema.fields}
          onSave={handle_save_approvers}
          resolveFullFieldOptions={resolveFullFieldOptions}
        />
      </div>
    </div>
  );
}
