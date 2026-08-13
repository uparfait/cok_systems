import React from "react";
import { useParams, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { get_project } from "../services/projectsService.js";
import DcsLoadingState from "../components/DcsLoadingState.jsx";

/**
 * Project shell: fetches the project (refreshed silently every 10s) and
 * renders the Settings/Forms sub-navigation with an outlet beneath it.
 */
export default function ProjectDetailPage() {
  const { project_id } = useParams();
  const { translate } = useDcsLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: project, loading } = useSilentPolling(() => get_project(project_id).then((res) => res.data), 10000, [project_id]);

  if (loading || !project) return <DcsLoadingState />;

  const base_path = `/dcs-system/project/${project_id}`;

  const TABS = [
    { key: "settings", labelKey: "DCS_PROJECT_NAV_SETTINGS", path: "settings" },
    { key: "forms", labelKey: "DCS_PROJECT_NAV_FORMS", path: "forms" },
    { key: "access-control", labelKey: "DCS_SECTION_ACCESS_CONTROL", path: "access-control" },
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex border-b mb-4 flex-wrap" style={{ borderColor: "#E0E0E0" }}>
        {TABS.map((tab) => {
          const is_active =
            location.pathname.startsWith(`${base_path}/${tab.path}`) || (tab.key === "settings" && location.pathname === base_path);
          return (
            <button key={tab.key} type="button" style={tab_style(is_active)} onClick={() => navigate(`${base_path}/${tab.path}`)}>
              {translate(tab.labelKey)}
            </button>
          );
        })}
      </div>
      <Outlet context={{ project }} />
    </div>
  );
}
