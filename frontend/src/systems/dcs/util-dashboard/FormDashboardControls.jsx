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
 * Dashboard controls on the form overview: generate this form's widgets on
 * the project dashboard in one click (KPIs, over-time line, one chart per
 * choice field, treemaps for cascades), delete exactly this form's widgets
 * again, and jump to the dashboard itself. Generation and deletion go
 * through the same save endpoint as the manual builder, so other forms'
 * widgets are never touched and everything stays editable afterwards.
 */
export default function FormDashboardControls({ projectId, form }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [can_edit, setCanEdit] = useState(false);
  const [own_count, setOwnCount] = useState(0);
  const [working, setWorking] = useState(false);
  const [confirming, setConfirming] = useState(null);

  useEffect(() => {
    let is_mounted = true;
    get_dashboard(projectId)
      .then((response) => {
        if (!is_mounted) return;
        const data = response.data || {};
        setCanEdit(data.can_edit === true);
        setOwnCount(((data.widgets || []).filter((widget) => widget.form_group_id === form.form_group_id)).length);
      })
      .catch(() => is_mounted && setCanEdit(false));
    return () => {
      is_mounted = false;
    };
  }, [projectId, form.form_group_id]);

  // Both actions re-read the dashboard first so a save from another tab is
  // never overwritten with stale widgets.
  const apply = async (build_next_widgets, toast_message) => {
    setWorking(true);
    try {
      const current = await get_dashboard(projectId);
      const others = ((current.data && current.data.widgets) || []).filter(
        (widget) => widget.form_group_id !== form.form_group_id,
      );
      const next_widgets = build_next_widgets(others).map((widget, index) => ({ ...widget, position: index }));
      const saved = await save_dashboard(projectId, next_widgets);
      const saved_widgets = (saved.data && saved.data.widgets) || next_widgets;
      setOwnCount(saved_widgets.filter((widget) => widget.form_group_id === form.form_group_id).length);
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
    apply((others) => others.concat(generated), translate("DCS_DB_GENERATED_TOAST", { count: generated.length }));
  };

  const handle_delete = () => {
    apply((others) => others, translate("DCS_DB_DELETED_TOAST"));
  };

  return (
    <div className="dcs-home-glass-card p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
        {translate("DCS_DB_FORM_SECTION_TITLE")}
      </p>
      <p className="text-xs mb-3" style={{ color: "#9E9E9E" }}>
        {own_count > 0 ? translate("DCS_DB_FORM_WIDGET_COUNT", { count: own_count }) : translate("DCS_DB_FORM_SECTION_HINT")}
      </p>
      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        {can_edit && (
          <div className="w-full sm:w-56">
            <DcsButtonPrimary
              type="button"
              disabled={working}
              onClick={() => (own_count > 0 ? setConfirming("generate") : handle_generate())}
            >
              {working ? translate("DCS_DB_WORKING") : translate("DCS_DB_BTN_GENERATE")}
            </DcsButtonPrimary>
          </div>
        )}
        <div className="w-full sm:w-48">
          <DcsButtonOutline type="button" onClick={() => navigate(`/dcs-system/project/${projectId}/dashboard`)}>
            {translate("DCS_DB_BTN_VIEW")}
          </DcsButtonOutline>
        </div>
        {can_edit && own_count > 0 && (
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
