import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { get_forms_by_project } from "../services/formsService.js";
import DcsSidebarProjectForms from "./DcsSidebarProjectForms.jsx";

const PRIMARY = "#056daa";

/**
 * One project row in the DCS sidebar: the name navigates to the project
 * page and automatically drops the forms list open, the chevron alone
 * toggles the dropdown without navigating. The row is highlighted active
 * whenever the current route is this project (or one of its forms),
 * matching the usual app sidebar's active-link pattern. The forms list is
 * fetched here (not inside the dropdown) so the total count can always be
 * shown next to the project name, even while collapsed.
 */
export default function DcsSidebarProjectRow({ project }) {
  const navigate = useNavigate();
  const location = useLocation();
  const project_path = `/dcs-system/project/${project._id}`;
  const is_active = location.pathname === project_path || location.pathname.startsWith(`${project_path}/`);
  const [is_expanded, setIsExpanded] = useState(is_active && location.pathname.includes("/forms/"));

  const { data: forms } = useSilentPolling(
    () => get_forms_by_project(project._id).then((res) => res.data || []),
    10000,
    [project._id],
  );
  const forms_count = (forms || []).length;

  return (
    <div>
      <div className="flex items-center gap-1 pr-2">
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="p-1.5 cursor-pointer flex-shrink-0"
          aria-label="toggle"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={is_active ? PRIMARY : "#9E9E9E"}
            strokeWidth="2"
            style={{ transform: is_expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s ease" }}
          >
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={() => {
            navigate(project_path);
            setIsExpanded(true);
          }}
          className="flex-1 min-w-0 cursor-pointer flex items-center justify-between gap-2 text-left px-2 py-2"
          title={project.name}
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 13,
            fontWeight: is_active ? 700 : 500,
            color: is_active ? PRIMARY : "#333333",
            backgroundColor: is_active ? "rgba(5,109,170,0.08)" : "transparent",
            borderLeft: is_active ? `3px solid ${PRIMARY}` : "3px solid transparent",
          }}
        >
          <span className="truncate">{project.name}</span>
          <span
            className="flex-shrink-0 text-xs"
            style={{ color: is_active ? PRIMARY : "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}
          >
            {forms_count}
          </span>
        </button>
      </div>
      {is_expanded && <DcsSidebarProjectForms project={project} forms={forms} />}
    </div>
  );
}
