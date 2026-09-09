import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_dashboard, save_dashboard } from "./dashboardService.js";
import { generate_form_widgets } from "./autoGenerate.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";

const DANGER = "#E74C3C";

/**
 * Dashboard controls on the form overview - every form owns its own
 * dashboard: generate it in one click (KPIs, over-time line, one chart per
 * choice field, treemaps for cascades), delete it again, or open the form's
 * Dashboard tab to view and fine-tune it. Generation and deletion go
 * through the same save endpoint as the manual builder, so everything stays
 * editable afterwards.
 */
export default function FormDashboardControls({ projectId, form }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [can_edit, setCanEdit] = useState(false);
  const [widget_count, setWidgetCount] = useState(0);
  const [working, setWorking] = useState(false);
  const [confirming, setConfirming] = useState(null);

  useEffect(() => {
    let is_mounted = true;
    get_dashboard(form.form_group_id)
      .then((response) => {
        if (!is_mounted) return;
        const data = response.data || {};
        setCanEdit(data.can_edit === true);
        setWidgetCount((data.widgets || []).length);
      })
      .catch(() => is_mounted && setCanEdit(false));
    return () => {
      is_mounted = false;
    };
  }, [form.form_group_id]);

  const dashboard_path = `/dcs-system/project/${projectId}/forms/${form.form_group_id}/dashboard`;

  const apply = async (next_widgets, toast_message) => {
    setWorking(true);
    try {
      const saved = await save_dashboard(form.form_group_id, next_widgets);
      setWidgetCount(((saved.data && saved.data.widgets) || next_widgets).length);
      showSuccess(toast_message);
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setWorking(false);
      setConfirming(null);
    }
  };

  const handle_generate = () => {
    const generated = generate_form_widgets(form, translate);
    if (generated.length === 0) {
      showError(translate("DCS_DB_NOTHING_TO_GENERATE"));
      setConfirming(null);
      return;
    }
    apply(generated, translate("DCS_DB_GENERATED_TOAST", { count: generated.length }));
  };

  const handle_delete = () => {
    apply([], translate("DCS_DB_DELETED_TOAST"));
  };

  return (
    <div className="dcs-home-glass-card p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
        {translate("DCS_DB_FORM_SECTION_TITLE")}
      </p>
      <p className="text-xs mb-3" style={{ color: "#9E9E9E" }}>
        {widget_count > 0 ? translate("DCS_DB_FORM_WIDGET_COUNT", { count: widget_count }) : translate("DCS_DB_FORM_SECTION_HINT")}
      </p>
      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        {can_edit && (
          <div className="w-full sm:w-56">
            <DcsButtonPrimary
              type="button"
              disabled={working}
              onClick={() => (widget_count > 0 ? setConfirming("generate") : handle_generate())}
            >
              {working ? translate("DCS_DB_WORKING") : translate("DCS_DB_BTN_GENERATE")}
            </DcsButtonPrimary>
          </div>
        )}
        <div className="w-full sm:w-48">
          <DcsButtonOutline type="button" onClick={() => navigate(dashboard_path)}>
            {translate("DCS_DB_BTN_VIEW")}
          </DcsButtonOutline>
        </div>
        {can_edit && widget_count > 0 && (
          <div className="w-full sm:w-56">
            <DcsButtonOutline type="button" variant="danger" disabled={working} onClick={() => setConfirming("delete")} style={{ color: DANGER }}>
              {translate("DCS_DB_BTN_DELETE")}
            </DcsButtonOutline>
          </div>
        )}
      </div>

      {confirming === "generate" && (
        <DcsConfirmDialog
          titleKey="DCS_DB_GEN_CONFIRM_TITLE"
          messageKey="DCS_DB_GEN_CONFIRM_MESSAGE"
          confirming={working}
          onConfirm={handle_generate}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === "delete" && (
        <DcsConfirmDialog
          titleKey="DCS_DB_DEL_CONFIRM_TITLE"
          messageKey="DCS_DB_DEL_CONFIRM_MESSAGE"
          confirming={working}
          onConfirm={handle_delete}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
