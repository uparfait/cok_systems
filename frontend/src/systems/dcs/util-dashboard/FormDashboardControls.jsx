import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_dashboard } from "./dashboardService.js";
import { generate_and_save } from "./autoGenerate.js";
import GenerationProgress from "./GenerationProgress.jsx";
import GeneratedWidgetsReview from "./GeneratedWidgetsReview.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

/**
 * Dashboard controls on the form overview. The dashboard is generated
 * automatically from ALL of the form's fields - nothing to configure: while
 * the dashboard state is still being checked a loader shows; without a
 * dashboard (and the right to edit the form) only "Generate dashboard"
 * shows, with live progress and messages; a fresh generation NEVER
 * redirects - it opens the review list of every generated widget (no data
 * loaded) where the user prunes widgets one by one or by field and adjusts
 * titles and descriptions first; once a dashboard exists, "View dashboard"
 * opens the full-screen dashboard page, where it can also be regenerated or
 * deleted.
 */
export default function FormDashboardControls({ projectId, form }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [can_edit, setCanEdit] = useState(false);
  const [exists, setExists] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message_key: "" });
  const [review_widgets, setReviewWidgets] = useState(null);

  useEffect(() => {
    let is_mounted = true;
    setChecking(true);
    get_dashboard(form.form_group_id)
      .then((response) => {
        if (!is_mounted) return;
        const data = response.data || {};
        setCanEdit(data.can_edit === true);
        setExists(((data.widgets || []).length) > 0);
      })
      .catch(() => is_mounted && setCanEdit(false))
      .finally(() => is_mounted && setChecking(false));
    return () => {
      is_mounted = false;
    };
  }, [form.form_group_id]);

  const dashboard_path = `/dcs-system/project/${projectId}/forms/${form.form_group_id}/dashboard`;

  const handle_generate = async () => {
    setGenerating(true);
    setProgress({ percent: 5, message_key: "DCS_DB_GEN_PROGRESS_ANALYZE" });
    try {
      const saved_widgets = await generate_and_save(form, translate, (percent, message_key) =>
        setProgress({ percent, message_key }),
      );
      setExists(saved_widgets.length > 0);
      showSuccess(translate("DCS_DB_GENERATED_TOAST", { count: saved_widgets.length }));
      // No redirect: the user first reviews the generated widgets (nothing
      // loads data here) and decides what to keep before opening the full
      // basic dashboard.
      setReviewWidgets(saved_widgets);
    } catch (error) {
      showError(error.is_translation_key ? translate(error.message) : error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="dcs-home-glass-card p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
        {translate("DCS_DB_FORM_SECTION_TITLE")}
      </p>

      {checking ? (
        <div className="flex items-center gap-2 py-2">
          <SpiralLoader />
        </div>
      ) : generating ? (
        <GenerationProgress percent={progress.percent} messageKey={progress.message_key} />
      ) : review_widgets ? (
        <GeneratedWidgetsReview
          form={form}
          initialWidgets={review_widgets}
          onOpenDashboard={() => navigate(dashboard_path)}
          onClose={() => setReviewWidgets(null)}
          onCountChange={(count) => setExists(count > 0)}
        />
      ) : (
        <>
          <p className="text-xs mb-3" style={{ color: "#9E9E9E" }}>
            {exists ? translate("DCS_DB_AUTO_HINT") : translate("DCS_DB_FORM_SECTION_HINT")}
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            {!exists && can_edit && (
              <div className="w-full sm:w-56">
                <DcsButtonPrimary type="button" onClick={handle_generate}>
                  {translate("DCS_DB_BTN_GENERATE")}
                </DcsButtonPrimary>
              </div>
            )}
            {!exists && !can_edit && (
              <p className="text-xs" style={{ color: "#9E9E9E" }}>
                {translate("DCS_DB_EMPTY_HINT_VIEWER")}
              </p>
            )}
            {exists && (
              <div className="w-full sm:w-48">
                <DcsButtonPrimary type="button" onClick={() => navigate(dashboard_path)}>
                  {translate("DCS_DB_BTN_VIEW")}
                </DcsButtonPrimary>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
