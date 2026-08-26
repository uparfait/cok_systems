import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { create_template } from "../services/templatesService.js";
import DcFormBuilderSection from "../builder/DcFormBuilderSection.jsx";
import DcsTemplateNameField from "../components/DcsTemplateNameField.jsx";

/**
 * Building a brand new template - the exact same builder used for a form
 * (add/settings/delete/reorder fields, review, Ctrl+6 JSON overlay), just
 * saved as a reusable template instead of a form version.
 */
export default function NewTemplatePage() {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [fields, setFields] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [schema_errors, setSchemaErrors] = useState([]);

  const handle_fields_change = (next_fields) => {
    setSchemaErrors([]);
    setFields(next_fields);
  };

  const handle_publish = async (schema) => {
    setPublishing(true);
    try {
      const response = await create_template(name, description, schema.fields);
      showSuccess(translate("DCS_TOAST_TEMPLATE_SAVED"));
      navigate(`/dcs-system/templates/${response.data._id}/edit`);
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
        {translate("DCS_SECTION_NEW_TEMPLATE")}
      </h2>
      <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: "#E0E0E0" }}>
        <DcsTemplateNameField name={name} onNameChange={setName} description={description} onDescriptionChange={setDescription} />
        <DcFormBuilderSection
          fields={fields}
          onFieldsChange={handle_fields_change}
          onPublish={handle_publish}
          publishing={publishing}
          schemaErrors={schema_errors}
          publishLabelKey="DCS_BTN_SAVE_TEMPLATE"
        />
      </div>
    </div>
  );
}
