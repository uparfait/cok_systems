import React, { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { update_project, delete_project, transfer_project_ownership } from "../services/projectsService.js";
import ProjectDetailsForm from "../components/ProjectDetailsForm.jsx";
import DcsOwnershipTransfer from "../components/DcsOwnershipTransfer.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";

const DANGER = "#E74C3C";

/**
 * Project settings: edit name and description, hand the project over to
 * another employee (owner only), and permanently delete it along with
 * everything collected in it. Who may see the project is managed on the
 * Access control tab, not here.
 */
export default function ProjectSettingsPage() {
  const { project } = useOutletContext();
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [transferring, setTransferring] = useState(false);
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

  const handle_transfer = async (user) => {
    setTransferring(true);
    try {
      await transfer_project_ownership(project._id, user.user_id);
      showSuccess(translate("DCS_TOAST_OWNERSHIP_TRANSFERRED", { name: user.full_name || user.email }));
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="pb-16 space-y-4">
      <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: "#E0E0E0" }}>
        <ProjectDetailsForm initialValues={project} onSave={handle_save} saving={saving} submitLabelKey="DCS_BTN_SAVE" />
      </div>

      {project.viewer_is_owner === true && (
        <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: "#E0E0E0" }}>
          <DcsOwnershipTransfer ownerName={project.owner_name} onTransfer={handle_transfer} transferring={transferring} />
        </div>
      )}

      {project.viewer_is_owner === true && (
        <div className="bg-white border-2 p-4 sm:p-6" style={{ borderColor: DANGER }}>
          <DcsButtonPrimary
            style={{ backgroundColor: DANGER, borderColor: DANGER }}
            onClick={() => setIsConfirmingDelete(true)}
          >
            {translate("DCS_BTN_DELETE_PROJECT")}
          </DcsButtonPrimary>
        </div>
      )}

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
