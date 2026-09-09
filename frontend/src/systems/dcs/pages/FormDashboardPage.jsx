import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_form } from "../services/formsService.js";
import DashboardPage from "../util-dashboard/DashboardPage.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";

/**
 * The form's dashboard as its own FULL-SCREEN page (like the collected-data
 * pages), opened from the form overview's View dashboard button. It loads
 * the form itself, shows the form's name in the header with a way back to
 * the form, and renders the automatically generated dashboard below at full
 * width.
 */
export default function FormDashboardPage() {
  const { project_id, form_group_id } = useParams();
  const { translate } = useDcsLanguage();
  const { showError } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let is_mounted = true;
    setLoading(true);
    get_form(form_group_id)
      .then((response) => is_mounted && setForm(response.data))
      .catch((error) => is_mounted && showError(error.message || translate("DCS_ERROR_GENERIC")))
      .finally(() => is_mounted && setLoading(false));
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form_group_id]);

  const form_path = `/dcs-system/project/${project_id}/forms/${form_group_id}`;

  return (
    <div className="w-full px-3 sm:px-6 pt-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <span className="dcs-home-badge inline-flex items-center text-xs font-semibold uppercase tracking-wide px-3" style={{ height: 28 }}>
            {translate("DCS_DB_TITLE")}
          </span>
          <h1
            className="font-bold truncate mt-2"
            style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(1.2rem, 2.6vw, 1.8rem)", textTransform: "uppercase" }}
            title={form ? form.form_name : ""}
          >
            {form ? form.form_name || form_group_id : ""}
          </h1>
        </div>
        <DcsButtonOutline onClick={() => navigate(form_path)} style={{ width: "auto", height: 32, padding: "0 1rem" }}>
          {translate("DCS_DB_BACK_TO_FORM")}
        </DcsButtonOutline>
      </div>

      {loading ? <DcsLoadingState /> : form ? <DashboardPage form={form} /> : null}
    </div>
  );
}
