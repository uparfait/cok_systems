import React, { useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "../../../../core/contexts/ToastContext.tsx";
import { set_follow_up_active_version, delete_follow_up_version, get_follow_up_submissions } from "../../services/followUpService.js";
import DcsButtonOutline from "../DcsButtonOutline.jsx";
import DcsButtonOutlineDanger from "../DcsButtonOutlineDanger.jsx";
import DcsDeleteVersionDialog from "../DcsDeleteVersionDialog.jsx";

const FONT = "'Montserrat', sans-serif";

export default function FollowUpVersions({ formGroupId, versions, canEdit, recordCount, onChanged }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [activating_version, setActivatingVersion] = useState(null);
  const [version_pending_delete, setVersionPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const list = versions || [];
  const can_delete_active = list.length <= 1 && recordCount === 0;

  const handle_activate = async (version) => {
    setActivatingVersion(version);
    try {
      await set_follow_up_active_version(formGroupId, version);
      showSuccess(translate("DCS_FORM_ACTIVE_BADGE"));
      onChanged();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setActivatingVersion(null);
    }
  };

  const handle_confirm_delete = async (delete_data) => {
    setDeleting(true);
    try {
      const response = await delete_follow_up_version(formGroupId, version_pending_delete, delete_data);
      showSuccess(response.message || translate("DCS_TOAST_VERSION_DELETED"));
      setVersionPendingDelete(null);
      onChanged();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setDeleting(false);
    }
  };

  const count_records = (version) => get_follow_up_submissions(formGroupId, 1, 1, { version }).then((response) => response.total || 0);

  return (
    <div className="space-y-3">
      <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 18, color: "#333333" }}>{translate("DCS_FU_VERSIONS_TITLE")}</h2>

      {list.map((version_doc) => (
        <div key={version_doc._id || version_doc.version} className="bg-white border-2 p-4 flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "#E0E0E0" }}>
          <span className="block text-sm font-semibold truncate min-w-0" style={{ color: "#056daa", fontFamily: FONT }} title={version_doc.form_name || ""}>
            {translate("DCS_FORM_VERSION_LABEL", { version: version_doc.version })} - {version_doc.form_name || ""}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {version_doc.is_active && (
              <span className="text-xs font-semibold uppercase px-2 py-1" style={{ backgroundColor: "rgba(76,175,80,0.12)", color: "#4CAF50", fontFamily: FONT }}>
                {translate("DCS_FORM_ACTIVE_BADGE")}
              </span>
            )}
            {canEdit && !version_doc.is_active && activating_version === version_doc.version && (
              <div className="animate-spin rounded-full" style={{ width: 18, height: 18, border: "2px solid #056daa", borderTopColor: "transparent" }} />
            )}
            {canEdit && !version_doc.is_active && activating_version !== version_doc.version && (
              <DcsButtonOutline onClick={() => handle_activate(version_doc.version)} disabled={activating_version !== null}>
                {translate("DCS_BTN_ACTIVATE")}
              </DcsButtonOutline>
            )}
            {canEdit && (!version_doc.is_active || can_delete_active) && (
              <DcsButtonOutlineDanger onClick={() => setVersionPendingDelete(version_doc.version)} disabled={activating_version !== null}>
                {translate("DCS_BTN_DELETE")}
              </DcsButtonOutlineDanger>
            )}
          </div>
        </div>
      ))}

      {version_pending_delete !== null && (
        <DcsDeleteVersionDialog
          formGroupId={formGroupId}
          version={version_pending_delete}
          deleting={deleting}
          countSubmissions={count_records}
          onCancel={() => setVersionPendingDelete(null)}
          onConfirm={handle_confirm_delete}
        />
      )}
    </div>
  );
}
