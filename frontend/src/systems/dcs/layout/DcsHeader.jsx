import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../../../core/components/Layout/Header.tsx";
import DcsLanguageSwitcher from "../components/DcsLanguageSwitcher.jsx";
import DcsLogoMark from "../components/DcsLogoMark.jsx";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { build_dcs_breadcrumb_path } from "./dcsBreadcrumbPath.js";

/**
 * Reuses the same authenticated header every other system uses (profile,
 * notifications, logout), with no sidebar next to it. A slim translated
 * bar underneath carries a back icon, a Home link, a plain-text (never
 * clickable) breadcrumb of the current route template with real ids
 * swapped for their param name, and the language switcher.
 */
export default function DcsHeader({ subHeaderVisible = true, onMainMenuToggle, projects }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { translate } = useDcsLanguage();
  const breadcrumb_path = build_dcs_breadcrumb_path(location.pathname);
  const total_projects = projects ? projects.length : 0;
  const total_forms = projects ? projects.reduce((sum, project) => sum + (project.forms_count || 0), 0) : 0;

  return (
    <div className="flex-shrink-0">
      <Header
        onMenuToggle={onMainMenuToggle || (() => {})}
        currentSystem={<DcsLogoMark title={translate("DCS_HEADER_TITLE")} />}
        links={[]}
        currentPath={location.pathname}
        onNavigate={(path) => navigate(path)}
        alwaysShowMenuButton
      />
      <div className={`dcs-sub-header ${subHeaderVisible ? "" : "is-hidden"}`}>
        <div
          className="flex items-center justify-between px-4 lg:px-6 py-2 border-b"
          style={{ borderColor: "#E0E0E0", backgroundColor: "#F7F9FB" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              title={translate("DCS_BTN_BACK")}
              className="dcs-sidebar-toggle cursor-pointer flex items-center justify-center bg-white border flex-shrink-0"
              style={{ width: 30, height: 30, borderRadius: "50%", borderColor: "#E0E0E0" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => navigate("/dcs-system")}
              className="dcs-sub-header-home-link text-sm font-semibold cursor-pointer flex-shrink-0"
              style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif" }}
            >
              {translate("DCS_BTN_HOME")}
            </button>

            {breadcrumb_path && (
              <span
                className="text-xs truncate"
                style={{ color: "#9E9E9E", fontFamily: "Consolas, monospace" }}
                title={breadcrumb_path}
              >
                /{breadcrumb_path}
              </span>
            )}
          </div>
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
