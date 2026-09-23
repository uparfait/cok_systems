import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { create_form } from "../services/formsService.js";
import DcFormBuilderSection from "../builder/DcFormBuilderSection.jsx";
import DcsFormNameField from "../components/DcsFormNameField.jsx";
import { validate_form_schema } from "../builder/validateSchema.js";
import TrackingSetupButton from "../tracking/TrackingSetupButton.jsx";
import RespondentGateToggle from "../builder/RespondentGateToggle.jsx";
import { empty_tracking, normalize_tracking, tracking_payload } from "../tracking/trackingConfig.js";

export default function NewFormPage() {
  const { project_id } = useParams();
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [fields, setFields] = useState([]);
  const [form_name, setFormName] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [schema_errors, setSchemaErrors] = useState([]);
  const [validation_result, setValidationResult] = useState({ valid: true, errors: [] });
  const [tracking, setTracking] = useState(empty_tracking);
  const [ask_respondent, setAskRespondent] = useState(true);

  // A deleted key or updatable field drops out of the tracking config too.
  const handle_fields_change = (next_fields) => {
    setSchemaErrors([]);
    setFields(next_fields);
    setTracking((previous) => normalize_tracking(previous, next_fields));
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

    setPublishing(true);
    try {
      // Approvals are not configured at creation time - the form's own
      // Approval tab manages them once the form exists.
      const response = await create_form(project_id, form_name, schema, null, tracking_payload(tracking), ask_respondent);
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
        <RespondentGateToggle value={ask_respondent} onChange={setAskRespondent} />
        <TrackingSetupButton fields={fields} tracking={tracking} onChange={setTracking} />
        <DcsFormNameField value={form_name} onChange={setFormName} />
        <DcFormBuilderSection
          fields={fields}
          onFieldsChange={handle_fields_change}
          onPublish={handle_publish}
          publishing={publishing}
          schemaErrors={schema_errors}
          onValidationChange={handle_validation_change}
          trackingScopeId={`new-form:${project_id}`}
          tracking={tracking}
          onTrackingChange={setTracking}
        />
      </div>
    </div>
  );
}
