import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { create_project } from "../services/projectsService.js";
import { create_form } from "../services/formsService.js";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import ProjectDetailsForm from "../components/ProjectDetailsForm.jsx";
import DcFormBuilderSection from "../builder/DcFormBuilderSection.jsx";
import DcsWizardSteps from "../components/DcsWizardSteps.jsx";
import DcsUnderDevelopmentPanel from "../components/DcsUnderDevelopmentPanel.jsx";
import DcsFormNameField from "../components/DcsFormNameField.jsx";

const DRAFT_FIELDS_KEY_PREFIX = "dcs_draft_fields_";

const STEPS = [
  { key: "details", labelKey: "DCS_SECTION_PROJECT_DETAILS" },
  { key: "form", labelKey: "DCS_SECTION_DC_FORM" },
  { key: "access", labelKey: "DCS_WIZARD_STEP_3" },
];

/**
 * Project creation flow as a three-step wizard: project details, then the
 * DC form builder, then access control and dashboard building (still under
 * development). A step only becomes reachable once the one before it is
 * filled in.
 */
export default function NewProjectPage() {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [creating_project, setCreatingProject] = useState(false);
  const [fields, setFields] = useState([]);
  const [form_name, setFormName] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [current_step, setCurrentStep] = useState(0);

  const max_reached_index = !project ? 0 : fields.length > 0 ? 2 : 1;

  useEffect(() => {
    if (current_step > max_reached_index) setCurrentStep(max_reached_index);
  }, [max_reached_index, current_step]);

  useEffect(() => {
    if (!project) return;
    window.localStorage.setItem(`${DRAFT_FIELDS_KEY_PREFIX}${project._id}`, JSON.stringify(fields));
  }, [fields, project]);

  const handle_section_one_save = async (values) => {
    setCreatingProject(true);
    try {
      const response = await create_project(values);
      setProject(response.data);
      const saved_draft = window.localStorage.getItem(`${DRAFT_FIELDS_KEY_PREFIX}${response.data._id}`);
      setFields(saved_draft ? JSON.parse(saved_draft) : []);
      showSuccess(translate("DCS_TOAST_PROJECT_SAVED"));
      setCurrentStep(1);
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setCreatingProject(false);
    }
  };

  const handle_publish = async (schema) => {
    setPublishing(true);
    try {
      const response = await create_form(project._id, form_name, schema);
      window.localStorage.removeItem(`${DRAFT_FIELDS_KEY_PREFIX}${project._id}`);
      showSuccess(translate("DCS_TOAST_FORM_PUBLISHED"));
      navigate(`/dcs-system/project/${project._id}/forms/${response.data.form_group_id}/details`);
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
      <DcsWizardSteps steps={STEPS} currentIndex={current_step} maxReachedIndex={max_reached_index} onSelect={setCurrentStep} />

      {current_step === 0 && (
        <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: "#E0E0E0" }}>
          <ProjectDetailsForm onSave={handle_section_one_save} saving={creating_project} submitLabelKey="DCS_BTN_SAVE_CONTINUE" />
        </div>
      )}

      {current_step === 1 && project && (
        <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: "#E0E0E0" }}>
          <h2 className="mb-4" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 18, color: "#333333" }}>
            {translate("DCS_SECTION_DC_FORM")}
          </h2>
          <DcsFormNameField value={form_name} onChange={setFormName} />
          <DcFormBuilderSection fields={fields} onFieldsChange={setFields} onPublish={handle_publish} publishing={publishing} />
        </div>
      )}

      {current_step === 2 && project && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DcsUnderDevelopmentPanel titleKey="DCS_SECTION_ACCESS_CONTROL" />
          <DcsUnderDevelopmentPanel titleKey="DCS_SECTION_BUILD_DASHBOARD" />
        </div>
      )}
    </div>
  );
}
