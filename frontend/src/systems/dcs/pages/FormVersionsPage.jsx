import React, { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { get_form_versions, set_active_version, delete_form_version } from "../services/formsService.js";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsButtonOutlineDanger from "../components/DcsButtonOutlineDanger.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";
import DcsDeleteVersionDialog from "../components/DcsDeleteVersionDialog.jsx";

/**
 * Lists every immutable version of a form, its own shareable link, which
 * one is active, and lets an author switch the active version, delete a
 * non-active one (optionally along with its collected data), or open its
 * collected data.
 */
export default function FormVersionsPage() {
  const { project_id, form_group_id, form } = useOutletContext();
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [activating_version, setActivatingVersion] = useState(null);
  const [version_pending_delete, setVersionPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data: versions, loading, refresh } = useSilentPolling(
    () => get_form_versions(form_group_id).then((res) => res.data || []),
    10000,
    [form_group_id],
  );

  const handle_activate = async (version) => {
    setActivatingVersion(version);
    try {
      await set_active_version(form_group_id, version);
      showSuccess(translate("DCS_FORM_ACTIVE_BADGE"));
      refresh();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setActivatingVersion(null);
    }
  };

  const handle_confirm_delete = async (delete_data) => {
    const was_only_version = (versions || []).length === 1;
    setDeleting(true);
    try {
      const response = await delete_form_version(form_group_id, version_pending_delete, delete_data);
      showSuccess(response.message || translate("DCS_TOAST_VERSION_DELETED"));
      setVersionPendingDelete(null);
      // Deleting a form's only (active) version leaves nothing behind for
      // this form_group at all - staying on its own now-nonexistent
      // versions/details page would just spin forever re-fetching a form
      // that's gone, so leave for the project's forms list instead of
      // refreshing in place.
      if (was_only_version) {
        navigate(`/dcs-system/project/${project_id}/forms`);
      } else {
        refresh();
      }
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <DcsLoadingState />;

  // Mirrors the backend's own guard exactly: the active version can only
  // ever be deleted when it is the form's only version (deleting it is
  // then really deleting the whole form) and the form has never collected
  // any data - never offer a button here that the server would just reject.
  const can_delete_active_version = (versions || []).length <= 1 && form && (form.total_submissions || 0) === 0;

  return (
    <div className="space-y-3 pb-16">
      <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 18, color: "#333333" }}>
        {translate("DCS_FORM_VERSIONS_TITLE")}
      </h2>

      {(versions || []).map((version_doc) => {
        const title = version_doc.form_name || form_group_id;
        return (
          <div key={version_doc._id} className="bg-white border-2 p-4 flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "#E0E0E0" }}>
            <button
              type="button"
              onClick={() => navigate(`/dcs-system/project/${project_id}/forms/${form_group_id}/${version_doc.version}/data`)}
              className="cursor-pointer text-left min-w-0"
            >
              <span className="block text-sm font-semibold truncate" style={{ color: "#056daa" }} title={title}>
                {translate("DCS_FORM_VERSION_LABEL", { version: version_doc.version })} - {title}
              </span>
            </button>
            <div className="flex items-center gap-2 flex-shrink-0">
              {version_doc.is_active && (
                <span
                  className="text-xs font-semibold uppercase px-2 py-1"
                  style={{ backgroundColor: "rgba(76,175,80,0.12)", color: "#4CAF50", fontFamily: "'Montserrat', sans-serif" }}
                >
                  {translate("DCS_FORM_ACTIVE_BADGE")}
                </span>
              )}
              {version_doc.is_active && can_delete_active_version && (
                <DcsButtonOutlineDanger onClick={() => setVersionPendingDelete(version_doc.version)}>
                  {translate("DCS_BTN_DELETE")}
                </DcsButtonOutlineDanger>
              )}
              {!version_doc.is_active && activating_version === version_doc.version && (
                <div
                  className="animate-spin rounded-full"
                  style={{ width: 18, height: 18, border: "2px solid #056daa", borderTopColor: "transparent" }}
                />
              )}
              {!version_doc.is_active && activating_version !== version_doc.version && (
                <DcsButtonOutline onClick={() => handle_activate(version_doc.version)} disabled={activating_version !== null}>
                  {translate("DCS_BTN_ACTIVATE")}
                </DcsButtonOutline>
              )}
              {!version_doc.is_active && (
                <DcsButtonOutlineDanger onClick={() => setVersionPendingDelete(version_doc.version)} disabled={activating_version !== null}>
                  {translate("DCS_BTN_DELETE")}
                </DcsButtonOutlineDanger>
              )}
            </div>
          </div>
        );
      })}

      {version_pending_delete !== null && (
        <DcsDeleteVersionDialog
          formGroupId={form_group_id}
          version={version_pending_delete}
          deleting={deleting}
          onCancel={() => setVersionPendingDelete(null)}
          onConfirm={handle_confirm_delete}
        />
      )}
    </div>
  );
}
