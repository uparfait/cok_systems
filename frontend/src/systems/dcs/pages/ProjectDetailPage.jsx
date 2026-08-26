import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { useScrollReveal } from "../home/useScrollReveal.js";
import { useCountUp } from "../home/useCountUp.js";
import { useAgeBreakdown } from "../hooks/useAgeBreakdown.js";
import { get_project } from "../services/projectsService.js";
import { get_forms_by_project } from "../services/formsService.js";
import { AGE_UNITS } from "../constants/ageUnits.js";
import DcsProjectDetailSkeleton from "../components/DcsProjectDetailSkeleton.jsx";
import DcsAgeChip from "../components/DcsAgeChip.jsx";
import DcsPanelToggleButton from "../components/DcsPanelToggleButton.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";
import ProjectsIllustration from "../home/illustrations/ProjectsIllustration.jsx";

function DcsListSkeleton() {
  return (
    <ol className="space-y-3 pl-6" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <li key={index} className="animate-pulse h-4" style={{ width: `${72 - index * 10}%`, backgroundColor: "rgba(5,109,170,0.08)" }} />
      ))}
    </ol>
  );
}

function ProjectStatCard({ rawValue, labelKey, isActive, translate }) {
  const { text } = useCountUp(String(rawValue), isActive);
  return (
    <div className="dcs-home-glass-card flex flex-col items-center justify-center gap-1 p-5">
      <span className="font-bold" style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif", fontSize: "1.8rem" }}>
        {text}
      </span>
      <span
        className="text-xs uppercase tracking-wide text-center"
        style={{ color: "#555555", fontFamily: "'Montserrat', sans-serif" }}
      >
        {translate(labelKey)}
      </span>
    </div>
  );
}

/**
 * Project overview: name, description, a live age counter (years down to
 * seconds, exact and always ticking) and three stat cards. The routed
 * Settings/Forms/Access-control/Dashboard tabs that used to sit inline at
 * the top are opened by the flying icon at the top-right corner, and
 * replace the overview outright rather than floating over it - the two are
 * mutually exclusive, each simply mounting/unmounting as the icon is
 * clicked, sliding in from the opposite side the other one leaves toward.
 *
 * The ref below is attached from the very first render, loading state
 * included - useScrollReveal's IntersectionObserver only ever gets one
 * chance to attach (its effect deps never change), so the ref target must
 * already exist on mount rather than appearing later behind a loading gate.
 */
export default function ProjectDetailPage() {
  const { project_id } = useParams();
  const { translate } = useDcsLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { ref, isVisible } = useScrollReveal();
  const [is_panel_busy, setIsPanelBusy] = useState(false);

  const { data: project, loading } = useSilentPolling(() => get_project(project_id).then((res) => res.data), 10000, [project_id]);

  // useSilentPolling only flips `loading` on its very first-ever fetch, by
  // design (background refreshes of the SAME entity must never flash a
  // skeleton) - but that also means switching from one project to a
  // different one via the sidebar keeps `loading` false and briefly renders
  // the PREVIOUS project's data under the new URL, since the fetch for the
  // new project_id hasn't resolved yet. Comparing the fetched project's own
  // id against the route param catches exactly that window.
  const is_showing_wrong_project = project && String(project._id) !== project_id;
  const is_loading_project = loading || !project || is_showing_wrong_project;

  const age = useAgeBreakdown(project ? project.created_at : new Date(0).toISOString(), isVisible && !!project && !is_showing_wrong_project);

  const { data: forms, loading: forms_loading } = useSilentPolling(
    () => get_forms_by_project(project_id).then((res) => res.data || []),
    10000,
    [project_id],
  );

  const base_path = `/dcs-system/project/${project_id}`;
  const is_panel_open = location.pathname !== base_path;

  // Belt-and-braces: a tab that sets this while loading always clears it on
  // its own unmount, but resetting here too means the flying icon can never
  // get stuck disabled just because the panel itself closed mid-fetch.
  useEffect(() => {
    if (!is_panel_open) setIsPanelBusy(false);
  }, [is_panel_open]);

  const TABS = [
    { key: "settings", labelKey: "DCS_PROJECT_NAV_SETTINGS", path: "settings" },
    { key: "forms", labelKey: "DCS_PROJECT_NAV_FORMS", path: "forms" },
    ...(project && project.viewer_can_manage_access === true
      ? [{ key: "access-control", labelKey: "DCS_SECTION_ACCESS_CONTROL", path: "access-control" }]
      : []),
    { key: "dashboard", labelKey: "DCS_SECTION_BUILD_DASHBOARD", path: "dashboard" },
  ];

  const tab_style = (is_active) => ({
    fontFamily: "'Montserrat', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    padding: "0.6rem 1rem",
    color: is_active ? "#056daa" : "#9E9E9E",
    borderBottom: is_active ? "2px solid #056daa" : "2px solid transparent",
    cursor: "pointer",
  });

  const handle_toggle_panel = () => {
    if (is_panel_busy) return;
    navigate(is_panel_open ? base_path : `${base_path}/settings`);
  };

  return (
    <div ref={ref} className="relative max-w-5xl mx-auto pb-16">
      {is_loading_project && <DcsProjectDetailSkeleton />}

      {project && !is_showing_wrong_project && (
        <>
          {!is_panel_open && (
            <div className="dcs-project-slide-in-left">
              <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 lg:gap-10 items-center mb-8">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap pr-16 lg:pr-0">
                    <span className="dcs-home-badge self-start text-xs font-semibold uppercase tracking-wide px-3 py-1">
                      {translate("DCS_PROJECT_OVERVIEW_EYEBROW")}
                    </span>
                    <DcsButtonOutline className="w-full sm:w-auto" onClick={() => navigate(`${base_path}/settings`)}>
                      {translate("DCS_BTN_GOTO_PROJECT_SETTINGS")}
                    </DcsButtonOutline>
                  </div>
                  <h1 className="font-bold wrap-break-word" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(1.5rem, 3.2vw, 2.2rem)" }}>
                    {project.name}
                  </h1>

                  <div className="dcs-home-glass-card--tint lg:hidden flex items-center justify-center p-5" style={{ minHeight: 180 }}>
                    <div style={{ width: "100%", maxWidth: 240 }}>
                      <ProjectsIllustration />
                    </div>
                  </div>

                  <p style={{ color: "#555555", fontFamily: "'Montserrat', sans-serif", fontSize: "1rem", lineHeight: 1.7 }}>
                    {project.description || translate("DCS_PROJECT_NO_DESCRIPTION")}
                  </p>
                  <span className="text-xs uppercase tracking-wide" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
                    {translate("DCS_PROJECT_CREATED_LABEL", { date: new Date(project.created_at).toLocaleDateString() })}
                  </span>
                </div>

                <div className="dcs-home-glass-card--tint hidden lg:flex items-center justify-center p-6" style={{ minHeight: 260 }}>
                  <div style={{ width: "100%", maxWidth: 300 }}>
                    <ProjectsIllustration />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="dcs-home-glass-card p-5 flex flex-col items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
                    {translate("DCS_PROJECT_AGE_CARD_TITLE")}
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {AGE_UNITS.map((unit) => (
                      <DcsAgeChip key={unit.key} value={age[unit.key]} labelKey={unit.labelKey} translate={translate} />
                    ))}
                  </div>
                </div>
                <ProjectStatCard rawValue={project.forms_count || 0} labelKey="DCS_PROJECT_STAT_FORMS" isActive={isVisible} translate={translate} />
                <ProjectStatCard rawValue={project.total_submissions || 0} labelKey="DCS_PROJECT_STAT_SUBMISSIONS" isActive={isVisible} translate={translate} />
              </div>

              <div className="mt-8">
                <h2 className="mb-3" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 16, color: "#333333" }}>
                  {translate("DCS_PROJECT_NAV_FORMS")}
                </h2>
                {forms_loading && <DcsListSkeleton />}
                {!forms_loading && (!forms || forms.length === 0) && <DcsEmptyState messageKey="DCS_FORMS_LIST_EMPTY" />}
                {!forms_loading && forms && forms.length > 0 && (
                  <ol className="space-y-2 pl-6 list-decimal">
                    {forms.map((form) => {
                      const form_path = `${base_path}/forms/${form.form_group_id}`;
                      return (
                        <li key={form.form_group_id}>
                          <a
                            href={form_path}
                            onClick={(event) => {
                              event.preventDefault();
                              navigate(form_path);
                            }}
                            className="hover:underline"
                            style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}
                          >
                            {form.form_name || form.form_group_id}
                          </a>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>
          )}

          {is_panel_open && (
            <div className="dcs-project-slide-in-right">
              <div className="flex border-b flex-wrap" style={{ borderColor: "#E0E0E0" }}>
                {TABS.map((tab) => {
                  const is_active = location.pathname.startsWith(`${base_path}/${tab.path}`);
                  return (
                    <button key={tab.key} type="button" style={tab_style(is_active)} onClick={() => navigate(`${base_path}/${tab.path}`)}>
                      {translate(tab.labelKey)}
                    </button>
                  );
                })}
              </div>
              <div className="pt-4">
                <Outlet context={{ project, setPanelBusy: setIsPanelBusy }} />
              </div>
            </div>
          )}

          <DcsPanelToggleButton
            isOpen={is_panel_open}
            isBusy={is_panel_busy}
            onClick={handle_toggle_panel}
            openTitleKey="DCS_PROJECT_PANEL_OPEN"
            closeTitleKey="DCS_PROJECT_PANEL_CLOSE"
          />
        </>
      )}
    </div>
  );
}
