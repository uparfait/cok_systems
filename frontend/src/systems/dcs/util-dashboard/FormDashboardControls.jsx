import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { list_dashboards, get_dashboard, request_error_text } from "./dashboardService.js";
import GeneratedWidgetsReview from "./GeneratedWidgetsReview.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

/**
 * Dashboard controls on the form overview. A form holds any number of
 * named dashboards: while the list is being fetched a loader shows;
 * without any dashboard (and the right to edit the form) "Create
 * dashboard" opens the dashboard page, which asks for the new dashboard's
 * name first; once dashboards exist, "View dashboards" opens the page on
 * the last dashboard used in this browser and "Review widgets" opens the
 * review overlay over that same dashboard's saved widgets.
 */
export default function FormDashboardControls({ projectId, form }) {
  const { translate } = useDcsLanguage();
  const { showError } = useToast();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [can_edit, setCanEdit] = useState(false);
  const [dashboards, setDashboards] = useState([]);
  const [review, setReview] = useState(null);
  const [review_loading, setReviewLoading] = useState(false);

  useEffect(() => {
    let is_mounted = true;
    setChecking(true);
    list_dashboards(form.form_group_id)
      .then((response) => {
        if (!is_mounted) return;
        const data = response.data || {};
        setCanEdit(data.can_edit === true);
        setDashboards(data.dashboards || []);
      })
      .catch(() => is_mounted && setCanEdit(false))
      .finally(() => is_mounted && setChecking(false));
    return () => {
      is_mounted = false;
    };
  }, [form.form_group_id]);

  const dashboard_path = `/dcs-system/project/${projectId}/forms/${form.form_group_id}/dashboard`;
  const exists = dashboards.length > 0;

  // The dashboard the page itself would open: the one last used here, or the first.
  const preferred = () => {
    let saved = "";
    try {
      saved = window.localStorage.getItem(`dcs_dashboard_active:${form.form_group_id}`) || "";
    } catch {
      saved = "";
    }
    return dashboards.find((entry) => entry.id === saved) || dashboards[0];
  };

  // "Review widgets" always fetches the SAVED board fresh from the backend
  // before opening the review - it works in a brand-new browser session.
  const handle_open_review = async () => {
    const target = preferred();
    if (!target) return;
    setReviewLoading(true);
    try {
      const response = await get_dashboard({ form_group_id: form.form_group_id, dashboard_id: target.id });
      const widgets = (response.data && response.data.widgets) || [];
      setReview({ form: { ...form, dashboard_id: target.id, dashboard_name: target.name }, widgets });
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    } finally {
      setReviewLoading(false);
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
      ) : (
        <>
          <p className="text-xs mb-3" style={{ color: "#9E9E9E" }}>
            {exists ? translate("DCS_DB_FORM_DASHBOARD_COUNT", { count: dashboards.length }) : translate("DCS_DB_FORM_SECTION_HINT")}
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            {!exists && can_edit && (
              <div className="w-full sm:w-56">
                <DcsButtonPrimary type="button" onClick={() => navigate(dashboard_path)}>
                  {translate("DCS_DB_CREATE_BTN")}
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
            {exists && can_edit && (
              <div className="w-full sm:w-44">
                {review_loading ? (
                  <SpiralLoader />
                ) : (
                  <DcsButtonOutline type="button" onClick={handle_open_review}>
                    {translate("DCS_DB_BTN_REVIEW")}
                  </DcsButtonOutline>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {review && (
        <GeneratedWidgetsReview
          form={review.form}
          initialWidgets={review.widgets}
          onOpenDashboard={() => navigate(dashboard_path)}
          onClose={() => setReview(null)}
          onCountChange={(count) => setDashboards((current) => current.map((entry) => (entry.id === review.form.dashboard_id ? { ...entry, widgets_count: count } : entry)))}
        />
      )}
    </div>
  );
}
