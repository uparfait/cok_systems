import React from "react";
import { useParams, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { useScrollReveal } from "../home/useScrollReveal.js";
import { useCountUp } from "../home/useCountUp.js";
import { useAgeBreakdown } from "../hooks/useAgeBreakdown.js";
import { get_form } from "../services/formsService.js";
import { AGE_UNITS } from "../constants/ageUnits.js";
import DcsProjectDetailSkeleton from "../components/DcsProjectDetailSkeleton.jsx";
import DcsFormNav from "../components/DcsFormNav.jsx";
import DcsAgeChip from "../components/DcsAgeChip.jsx";
import DcsFormSubmissionsChart from "../components/DcsFormSubmissionsChart.jsx";
import FormDashboardControls from "../util-dashboard/FormDashboardControls.jsx";

/**
 * Form overview: its name, a form age counter next to a deliberately
 * oversized "total data collected" number, and below that a
 * submissions-over-time chart (its own period selector and loading state).
 * Every area of a form - the overview itself, its collected data, its BSC
 * dashboard, Settings, Approval, Versions and test data - is reached
 * through the one navigation bar pinned to the top of the page, which
 * stays in place even while the form is still loading. The overview and
 * the routed tabs stay mutually exclusive, each simply mounting/unmounting
 * as the nav moves, sliding in from the opposite side the other one leaves
 * toward.
 *
 * The ref below is attached from the very first render, loading state
 * included - useScrollReveal's IntersectionObserver only ever gets one
 * chance to attach (its effect deps never change), so the ref target must
 * already exist on mount rather than appearing later behind a loading gate.
 */
export default function FormDetailPage() {
  const { project_id, form_group_id } = useParams();
  const { translate } = useDcsLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { ref, isVisible } = useScrollReveal();

  const { data: form, loading, error: form_error, refresh } = useSilentPolling(() => get_form(form_group_id).then((res) => res.data), 999999999, [form_group_id]);

  // Same guard as ProjectDetailPage: useSilentPolling only flips `loading`
  // on its very first-ever fetch, so switching from one form to a
  // different one (this page doesn't remount, only form_group_id changes)
  // would otherwise briefly show the PREVIOUS form's data under the new URL.
  const is_showing_wrong_form = form && form.form_group_id !== form_group_id;
  const is_loading_form = loading || !form || is_showing_wrong_form;

  const age = useAgeBreakdown(form ? form.created_at : new Date(0).toISOString(), isVisible && !!form && !is_showing_wrong_form);
  const { text: total_data_text } = useCountUp(String(form ? form.total_submissions || 0 : 0), isVisible && !!form && !is_showing_wrong_form);

  const base_path = `/dcs-system/project/${project_id}/forms/${form_group_id}`;
  const is_panel_open = location.pathname !== base_path;
  const title = form ? form.form_name || form_group_id : "";

  // Settings reads the form document itself, which this page otherwise only
  // ever fetches once - refetching first means opening it never shows a form
  // that has since been republished from somewhere else.
  const handle_before_navigate = (item) => {
    if (item.key === "settings") refresh();
  };

  return (
    <div ref={ref} className="relative w-full min-[760px]:w-[80vw] mx-auto pb-16">
      {/* The nav stays put while the form is still loading - only a form
          that could not be read at all has no header to show. */}
      {!form_error && (
        <DcsFormNav projectId={project_id} formGroupId={form_group_id} formName={form && !is_showing_wrong_form ? form.form_name : ""} onBeforeNavigate={handle_before_navigate} />
      )}

      {is_loading_form && <DcsProjectDetailSkeleton />}

      {form && !is_showing_wrong_form && (
        <>
          {!is_panel_open && (
            <div className="dcs-project-slide-in-left space-y-6">
              <h1 className="font-bold wrap-break-word truncate" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(1.5rem, 3.2vw, 2.2rem)", textTransform: "uppercase" }} title={title}>
                {title}
              </h1>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="dcs-home-glass-card p-5 sm:p-6 flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
                    {translate("DCS_FORM_AGE_CARD_TITLE")}
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {AGE_UNITS.map((unit) => (
                      <DcsAgeChip key={unit.key} value={age[unit.key]} labelKey={unit.labelKey} translate={translate} />
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`${base_path}/data`)}
                  title={translate("DCS_FORM_TOTAL_DATA_OPEN_HINT")}
                  className="dcs-home-glass-card dcs-stat-card-link p-5 sm:p-6 flex flex-col items-center justify-center gap-1 cursor-pointer w-full"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
                    {translate("DCS_FORM_TOTAL_DATA_LABEL")}
                  </span>
                  <span className="font-bold" style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(2.6rem, 9vw, 4.5rem)", lineHeight: 1 }}>
                    {total_data_text}
                  </span>
                </button>
              </div>

              <DcsFormSubmissionsChart formGroupId={form_group_id} />

              <FormDashboardControls projectId={project_id} form={form} />
            </div>
          )}

          {is_panel_open && (
            <div className="dcs-project-slide-in-right">
              <Outlet context={{ project_id, form_group_id, form, refreshForm: refresh }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
