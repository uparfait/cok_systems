import React from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { get_forms_by_project } from "../services/formsService.js";
import { get_cached_forms, remember_forms } from "../hooks/formsCache.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";

function FormsListSkeleton() {
  return (
    <ol className="space-y-3 pl-6" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <li key={index} className="animate-pulse h-4" style={{ width: `${72 - index * 10}%`, backgroundColor: "rgba(5,109,170,0.08)" }} />
      ))}
    </ol>
  );
}

/**
 * Lists every form in a project as links (never a table). Starting a new
 * form navigates to its own dedicated page instead of expanding inline.
 */
export default function ProjectFormsListPage() {
  const { project } = useOutletContext();
  const { translate } = useDcsLanguage();
  const navigate = useNavigate();

  const { data: forms, loading } = useSilentPolling(
    () => get_forms_by_project(project._id).then((res) => remember_forms(project._id, res.data || [])),
    10000,
    [project._id],
    { initial: () => get_cached_forms(project._id) },
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

      {loading && <FormsListSkeleton />}
      {is_empty && <DcsEmptyState messageKey="DCS_FORMS_LIST_EMPTY" />}

      <ol className="space-y-2 pl-6 list-decimal">
        {(forms || []).map((form) => {
          const title = form.form_name || form.form_group_id;
          const form_path = `/dcs-system/project/${project._id}/forms/${form.form_group_id}`;
          return (
            <li key={form.form_group_id}>
              <a
                href={form_path}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(form_path);
                }}
                className="block cursor-pointer hover:underline"
                style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}
              >
                {title}
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
