import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../../../core/components/Layout/Header.tsx";
import DcsLanguageSwitcher from "../components/DcsLanguageSwitcher.jsx";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsContextNavLinks from "./DcsContextNavLinks.jsx";

/**
 * Reuses the same authenticated header every other system uses (profile,
 * notifications, logout), with no sidebar next to it. A slim translated
 * bar underneath carries the projects sidebar's own menu button - the same
 * button the header above it uses for the main sidebar - and the Home,
 * Templates and Approve data links on the left, the links of the open project or form in the
 * center (as many as fit, the rest behind "More"), and the totals plus
 * the language switcher on the right.
 */
export default function DcsHeader({ subHeaderVisible = true, onMainMenuToggle, onProjectsMenuToggle, projectsSidebarOpen, projects }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { translate } = useDcsLanguage();
  const is_home_active = location.pathname === "/dcs-system";
  const is_templates_active = location.pathname.startsWith("/dcs-system/templates");
  const total_projects = projects ? projects.length : 0;
  const total_forms = projects ? projects.reduce((sum, project) => sum + (project.forms_count || 0), 0) : 0;

  return (
    <div className="flex-shrink-0">
      <Header
        onMenuToggle={onMainMenuToggle || (() => {})}
        currentSystem={translate("DCS_HEADER_TITLE")}
        links={[]}
        currentPath={location.pathname}
        onNavigate={(path) => navigate(path)}
        alwaysShowMenuButton
      />
      <div className={`dcs-sub-header ${subHeaderVisible ? "" : "is-hidden"}`}>
        <div
          className="dcs-sub-header-row flex items-center justify-between gap-4 px-4 lg:px-6 py-2 border-b"
          style={{ borderColor: "#E0E0E0", backgroundColor: "#F7F9FB" }}
        >
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onProjectsMenuToggle || (() => {})}
              title={translate(projectsSidebarOpen ? "DCS_SIDEBAR_HIDE" : "DCS_SIDEBAR_SHOW")}
              className={`dcs-sub-header-menu p-2 rounded-none cursor-pointer flex-shrink-0 ${projectsSidebarOpen ? "is-open" : ""}`}
            >
              {/* A side panel with rows in it - what this button opens - so
                  it is never mistaken for the app menu above it. */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" />
                <line x1="9.5" y1="4" x2="9.5" y2="20" />
                <line x1="5.5" y1="8" x2="7.5" y2="8" />
                <line x1="5.5" y1="11.5" x2="7.5" y2="11.5" />
                <line x1="5.5" y1="15" x2="7.5" y2="15" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => navigate("/dcs-system")}
              className={`dcs-sub-header-home-link ${is_home_active ? "is-active" : ""} text-xs font-bold uppercase tracking-wide cursor-pointer flex-shrink-0`}
              style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif" }}
            >
              {translate("DCS_BTN_HOME")}
            </button>

            <button
              type="button"
              onClick={() => navigate("/dcs-system/templates")}
              className={`dcs-sub-header-home-link ${is_templates_active ? "is-active" : ""} text-xs font-bold uppercase tracking-wide cursor-pointer flex-shrink-0`}
              style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif" }}
            >
              {translate("DCS_BTN_TEMPLATES")}
            </button>

            <button
              type="button"
              onClick={() => navigate("/dcs-my-approvals")}
              className="dcs-sub-header-home-link text-xs font-bold uppercase tracking-wide cursor-pointer flex-shrink-0"
              style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif" }}
            >
              {translate("DCS_BTN_APPROVE_DATA")}
            </button>
          </div>

          <DcsContextNavLinks />
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-xs" style={{ color: "#555555", fontFamily: "'Montserrat', sans-serif" }}>
                {translate("DCS_HEADER_TOTAL_PROJECTS", { count: total_projects })}
              </span>
              <span className="text-xs" style={{ color: "#555555", fontFamily: "'Montserrat', sans-serif" }}>
                {translate("DCS_HEADER_TOTAL_FORMS", { count: total_forms })}
              </span>
            </div>
            <DcsLanguageSwitcher />
          </div>
        </div>
      </div>
    </div>
  );
}
