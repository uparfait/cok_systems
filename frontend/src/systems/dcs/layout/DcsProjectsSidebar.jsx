import React from "react";
import { useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { list_projects } from "../services/projectsService.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsSidebarProjectRow from "../components/DcsSidebarProjectRow.jsx";

const POLL_INTERVAL_MS = 10000;

/**
 * Small persistent sidebar listing every project, refreshed silently every
 * ten seconds, with a button to start a new project.
 */
export default function DcsProjectsSidebar() {
  const navigate = useNavigate();
  const { translate } = useDcsLanguage();
  const { data, loading } = useSilentPolling(() => list_projects().then((res) => res.data || []), POLL_INTERVAL_MS);

  return (
    <aside className="w-64 flex-shrink-0 bg-white border-r flex flex-col" style={{ borderColor: "#E0E0E0" }}>
      <div className="p-3 border-b" style={{ borderColor: "#E0E0E0" }}>
        <p
          className="text-xs font-semibold uppercase mb-2"
          style={{ fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px", color: "#9E9E9E" }}
        >
          {translate("DCS_SIDEBAR_PROJECTS_TITLE")}
        </p>
        <DcsButtonPrimary className="w-full" onClick={() => navigate("/dcs-system/new-project")}>
          {translate("DCS_SIDEBAR_NEW_PROJECT")}
        </DcsButtonPrimary>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {loading && (
          <p className="px-3 text-xs" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_SIDEBAR_LOADING")}
          </p>
        )}
        {!loading && (!data || data.length === 0) && (
          <p className="px-3 text-xs" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_SIDEBAR_NO_PROJECTS")}
          </p>
        )}
        {(data || []).map((project) => (
          <DcsSidebarProjectRow key={project._id} project={project} />
        ))}
      </div>
    </aside>
  );
}
