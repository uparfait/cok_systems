import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { create_form } from "../services/formsService.js";
import DcFormBuilderSection from "../builder/DcFormBuilderSection.jsx";
import DcsFormNameField from "../components/DcsFormNameField.jsx";

/**
 * Dedicated page for building a brand new form inside an existing project,
 * kept separate from the forms list so the list itself only ever shows
 * links.
 */
export default function NewFormPage() {
  const { project_id } = useParams();
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [fields, setFields] = useState([]);
  const [form_name, setFormName] = useState("");
  const [publishing, setPublishing] = useState(false);

  const handle_publish = async (schema) => {
    setPublishing(true);
    try {
      const response = await create_form(project_id, form_name, schema);
      showSuccess(translate("DCS_TOAST_FORM_PUBLISHED"));
      navigate(`/dcs-system/project/${project_id}/forms/${response.data.form_group_id}/details`);
      return true;
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
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
        <DcFormBuilderSection fields={fields} onFieldsChange={setFields} onPublish={handle_publish} publishing={publishing} />
      </div>
    </div>
  );
}
