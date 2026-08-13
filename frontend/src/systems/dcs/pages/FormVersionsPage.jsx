import React from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { get_form_versions, set_active_version } from "../services/formsService.js";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";

/**
 * Lists every immutable version of a form, its own shareable link, which
 * one is active, and lets an author switch the active version or open its
 * collected data.
 */
export default function FormVersionsPage() {
  const { project_id, form_group_id } = useOutletContext();
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const { data: versions, loading, refresh } = useSilentPolling(
    () => get_form_versions(form_group_id).then((res) => res.data || []),
    10000,
    [form_group_id],
  );

  const handle_activate = async (version) => {
    try {
      await set_active_version(form_group_id, version);
      showSuccess(translate("DCS_FORM_ACTIVE_BADGE"));
      refresh();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    }
  };

  if (loading) return <DcsLoadingState />;

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
              {!version_doc.is_active && (
                <DcsButtonOutline onClick={() => handle_activate(version_doc.version)}>{translate("DCS_BTN_ACTIVATE")}</DcsButtonOutline>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
