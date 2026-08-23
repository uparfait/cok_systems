import React, { useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { get_forms_by_project } from "../services/formsService.js";
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
  const { project, setPanelBusy } = useOutletContext();
  const { translate } = useDcsLanguage();
  const navigate = useNavigate();

  const { data: forms, loading } = useSilentPolling(
    () => get_forms_by_project(project._id).then((res) => res.data || []),
    10000,
    [project._id],
  );

  // Reported up so the panel's own flying icon disables itself while this
  // tab's data is still loading, instead of letting it be clicked away
  // mid-fetch. Always cleared on unmount, so switching tabs before the
  // fetch resolves can never leave the icon stuck disabled.
  useEffect(() => {
    if (setPanelBusy) setPanelBusy(loading);
    return () => {
      if (setPanelBusy) setPanelBusy(false);
    };
  }, [loading, setPanelBusy]);

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
            <li key={form.form_group_id}  className="hover:underline">
              <a
                href={form_path}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(form_path);
                }}
                className="hover:underline"
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
