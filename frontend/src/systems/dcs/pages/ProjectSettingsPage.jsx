import React, { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { update_project, delete_project } from "../services/projectsService.js";
import ProjectDetailsForm from "../components/ProjectDetailsForm.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";

const DANGER = "#E74C3C";

/**
 * Project settings: edit name, description and department assignment, and
 * permanently delete the project along with everything collected in it.
 */
export default function ProjectSettingsPage() {
  const { project } = useOutletContext();
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [is_confirming_delete, setIsConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handle_save = async (values) => {
    setSaving(true);
    try {
      await update_project(project._id, values);
      showSuccess(translate("DCS_TOAST_PROJECT_SAVED"));
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSaving(false);
    }
  };

  const handle_delete = async () => {
    setDeleting(true);
    try {
      await delete_project(project._id);
      navigate("/dcs-system");
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
      setDeleting(false);
      setIsConfirmingDelete(false);
    }
  };

  return (
    <div className="pb-16 space-y-4">
      <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: "#E0E0E0" }}>
        <ProjectDetailsForm initialValues={project} onSave={handle_save} saving={saving} submitLabelKey="DCS_BTN_SAVE" />
      </div>

      <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: DANGER }}>
        <DcsButtonPrimary
          style={{ backgroundColor: DANGER, borderColor: DANGER }}
          onClick={() => setIsConfirmingDelete(true)}
        >
          {translate("DCS_BTN_DELETE_PROJECT")}
        </DcsButtonPrimary>
      </div>

      {is_confirming_delete && (
        <DcsConfirmDialog
          titleKey="DCS_PROJECT_DELETE_TITLE"
          messageKey="DCS_PROJECT_DELETE_WARNING"
          confirming={deleting}
          onConfirm={handle_delete}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
