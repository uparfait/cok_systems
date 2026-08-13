import React from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { get_forms_by_project } from "../services/formsService.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";
import DcsLoadingState from "../components/DcsLoadingState.jsx";

/**
 * Lists every form in a project as links (never a table). Starting a new
 * form navigates to its own dedicated page instead of expanding inline.
 */
export default function ProjectFormsListPage() {
  const { project } = useOutletContext();
  const { translate } = useDcsLanguage();
  const navigate = useNavigate();

  const { data: forms, loading } = useSilentPolling(
    () => get_forms_by_project(project._id).then((res) => res.data || []),
    10000,
    [project._id],
  );

  const is_empty = !loading && (!forms || forms.length === 0);

  return (
    <div className="space-y-4 pb-16">
      <div className={is_empty ? "flex justify-center" : "flex justify-end"}>
        <DcsButtonPrimary
          className="w-full sm:w-auto"
          style={is_empty ? { padding: "1.2rem 2rem", fontSize: 14 } : { maxHeight: "300px" }}
          onClick={() => navigate(`/dcs-system/project/${project._id}/forms/new`)}
        >
          {translate("DCS_BTN_NEW_FORM")}
        </DcsButtonPrimary>
      </div>

      {loading && <DcsLoadingState />}
      {is_empty && <DcsEmptyState messageKey="DCS_FORMS_LIST_EMPTY" />}

      <div className="space-y-2">
        {(forms || []).map((form) => {
          const title = form.form_name || form.form_group_id;
          return (
            <button
              key={form.form_group_id}
              onClick={() => navigate(`/dcs-system/project/${project._id}/forms/${form.form_group_id}/details`)}
              className="w-full cursor-pointer text-left px-4 py-3 border bg-white hover:bg-gray-50"
              style={{ borderColor: "#E0E0E0", color: "#056daa", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}
            >
              {title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
