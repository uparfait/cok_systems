import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { useScrollReveal } from "../home/useScrollReveal.js";
import { useCountUp } from "../home/useCountUp.js";
import { useAgeBreakdown } from "../hooks/useAgeBreakdown.js";
import { get_form } from "../services/formsService.js";
import { AGE_UNITS } from "../constants/ageUnits.js";
import DcsProjectDetailSkeleton from "../components/DcsProjectDetailSkeleton.jsx";
import DcsAgeChip from "../components/DcsAgeChip.jsx";
import DcsPanelToggleButton from "../components/DcsPanelToggleButton.jsx";
import DcsFormSubmissionsChart from "../components/DcsFormSubmissionsChart.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";

/**
 * Form overview: its name, a form age counter next to a deliberately
 * oversized "total data collected" number, and below that a
 * submissions-over-time chart (its own period selector and loading state).
 * The routed
 * Settings/Versions tabs that used to sit inline at the top are opened by
 * the flying icon at the top-right corner, and replace the overview
 * outright rather than floating over it - the same mutually-exclusive,
 * opposite-side-slide-in pattern as the project detail page.
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
  const [is_panel_busy, setIsPanelBusy] = useState(false);

  const { data: form, loading, refresh } = useSilentPolling(() => get_form(form_group_id).then((res) => res.data), 10000, [form_group_id]);

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
  const is_versions_tab = location.pathname.startsWith(`${base_path}/versions`);
  const is_approval_tab = location.pathname.startsWith(`${base_path}/approval`);
  const title = form ? form.form_name || form_group_id : "";

  // Belt-and-braces: resetting here too means the flying icon can never get
  // stuck disabled just because the panel itself closed mid-fetch.
  useEffect(() => {
    if (!is_panel_open) setIsPanelBusy(false);
  }, [is_panel_open]);

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
    navigate(is_panel_open ? base_path : `${base_path}/details`);
  };

  return (
    <div ref={ref} className="relative w-full min-[760px]:w-[80vw] mx-auto pb-16">
      {is_loading_form && <DcsProjectDetailSkeleton />}

      {form && !is_showing_wrong_form && (
        <>
          {!is_panel_open && (
            <div className="dcs-project-slide-in-left space-y-6">
              <div>
                <div className="flex items-center justify-between flex-wrap gap-3 mb-3 pr-16 min-[760px]:pr-0">
                  <span className="dcs-home-badge inline-flex items-center text-xs font-semibold uppercase tracking-wide px-3" style={{ height: 28 }}>
                    {translate("DCS_FORM_OVERVIEW_EYEBROW")}
                  </span>
                  <div className="flex items-center flex-wrap gap-3">
                    <DcsButtonOutline onClick={() => navigate(`${base_path}/data`)} className="flex items-center gap-2" style={{ width: "auto", height: 28, padding: "0 1rem" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="16" rx="1" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                        <line x1="9" y1="10" x2="9" y2="20" />
                      </svg>
                      {translate("DCS_DATA_COLLECTED_CARD_TITLE")}
                    </DcsButtonOutline>
                    <DcsButtonOutline onClick={() => navigate(`${base_path}/details`)} style={{ width: "auto", height: 28, padding: "0 1rem" }}>
                      {translate("DCS_BTN_GOTO_FORM_SETTINGS")}
                    </DcsButtonOutline>
                  </div>
                </div>
                <h1 className="font-bold wrap-break-word truncate" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(1.5rem, 3.2vw, 2.2rem)", textTransform: "uppercase" }} title={title}>
                  {title}
                </h1>
              </div>

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

                <div className="dcs-home-glass-card p-5 sm:p-6 flex flex-col items-center justify-center gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
                    {translate("DCS_FORM_TOTAL_DATA_LABEL")}
                  </span>
                  <span className="font-bold" style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(2.6rem, 9vw, 4.5rem)", lineHeight: 1 }}>
                    {total_data_text}
                  </span>
                </div>
              </div>

              <DcsFormSubmissionsChart formGroupId={form_group_id} />
            </div>
          )}

          {is_panel_open && (
            <div className="dcs-project-slide-in-right">
              <div className="flex border-b mb-4" style={{ borderColor: "#E0E0E0" }}>
                <button
                  type="button"
                  style={tab_style(!is_versions_tab && !is_approval_tab)}
                  onClick={() => {
                    refresh();
                    navigate(`${base_path}/details`);
                  }}
                >
                  {translate("DCS_FORM_NAV_SETTINGS")}
                </button>
                <button type="button" style={tab_style(is_approval_tab)} onClick={() => navigate(`${base_path}/approval`)}>
                  {translate("DCS_FORM_NAV_APPROVAL")}
                </button>
                <button type="button" style={tab_style(is_versions_tab)} onClick={() => navigate(`${base_path}/versions`)}>
                  {translate("DCS_FORM_NAV_VERSIONS")}
                </button>
              </div>
              <Outlet context={{ project_id, form_group_id, form, refreshForm: refresh }} />
            </div>
          )}

          <DcsPanelToggleButton
            isOpen={is_panel_open}
            isBusy={is_panel_busy}
            onClick={handle_toggle_panel}
            openTitleKey="DCS_FORM_PANEL_OPEN"
            closeTitleKey="DCS_FORM_PANEL_CLOSE"
          />
        </>
      )}
    </div>
  );
}
