import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_form } from "../services/formsService.js";
import DashboardPage from "../util-dashboard/DashboardPage.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";
import DcsFormNav from "../components/DcsFormNav.jsx";

/**
 * The form's dashboard as its own FULL-WIDTH page (like the collected-data
 * pages), opened from the form overview's View dashboard button. It loads
 * the form itself, shows the form's name in the header and renders the
 * automatically generated dashboard below. Navigation back happens through
 * the browser/app navigation - no extra button cluttering the header.
 */
export default function FormDashboardPage() {
  const { project_id, form_group_id } = useParams();
  const { translate } = useDcsLanguage();
  const { showError } = useToast();
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

  return (
    <div className="w-full px-3 sm:px-6 pb-16">
      <DcsFormNav projectId={project_id} formGroupId={form_group_id} />
      {loading ? <DcsLoadingState /> : form ? <DashboardPage form={form} /> : null}
    </div>
  );
}
