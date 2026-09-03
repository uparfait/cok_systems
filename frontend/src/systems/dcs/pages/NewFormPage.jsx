import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { create_form } from "../services/formsService.js";
import DcFormBuilderSection from "../builder/DcFormBuilderSection.jsx";
import ApprovalFlowSection, { is_approval_config_complete } from "../builder/ApprovalFlowSection.jsx";
import DcsFormNameField from "../components/DcsFormNameField.jsx";
import { validate_form_schema } from "../builder/validateSchema.js";

export default function NewFormPage() {
  const { project_id } = useParams();
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [fields, setFields] = useState([]);
  const [form_name, setFormName] = useState("");
  const [approval_config, setApprovalConfig] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [schema_errors, setSchemaErrors] = useState([]);
  const [validation_result, setValidationResult] = useState({ valid: true, errors: [] });

  const handle_fields_change = (next_fields) => {
    setSchemaErrors([]);
    setFields(next_fields);
  };

  const handle_validation_change = (result) => {
    setValidationResult(result);
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
      const response = await create_form(project_id, form_name, schema, approval_config);
      showSuccess(translate("DCS_TOAST_FORM_PUBLISHED"));
      navigate(`/dcs-system/project/${project_id}/forms/${response.data.form_group_id}/details`);
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
    <div className="w-full min-[760px]:w-[80vw] mx-auto pb-16">
      <h2 className="mb-4" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 18, color: "#333333" }}>
        {translate("DCS_SECTION_DC_FORM")}
      </h2>
      <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: "#E0E0E0" }}>
        <DcsFormNameField value={form_name} onChange={setFormName} />
        <DcFormBuilderSection
          fields={fields}
          onFieldsChange={handle_fields_change}
          onPublish={handle_publish}
          publishing={publishing}
          schemaErrors={schema_errors}
          onValidationChange={handle_validation_change}
        />
        <ApprovalFlowSection value={approval_config} onChange={setApprovalConfig} fields={fields} />
      </div>
    </div>
  );
}
