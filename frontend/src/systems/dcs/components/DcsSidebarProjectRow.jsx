import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DcsSidebarProjectForms from "./DcsSidebarProjectForms.jsx";
import DcsHighlightedText from "./DcsHighlightedText.jsx";

const PRIMARY = "#056daa";

/**
 * One project row in the DCS sidebar: the name navigates to the project
 * page and automatically drops the forms list open, the chevron alone
 * toggles the dropdown without navigating. The row is highlighted active
 * whenever the current route is this project (or one of its forms),
 * matching the usual app sidebar's active-link pattern. The forms count
 * comes straight from the project object (computed once, for every project,
 * by the single sidebar-level project poll) - this row never polls on its
 * own, so the number of active pollers never grows with the project count.
 *
 * searchQuery/forceExpanded are only set while the sidebar search box has
 * text in it: a matched project or a project containing a matched form is
 * shown as this exact same row (never a separate "results" list), with the
 * matching substring marked and, when the match is one of its forms, its
 * dropdown forced open. Any row drops open on its chevron, active or not.
 */
export default function DcsSidebarProjectRow({ project, searchQuery, forceExpanded }) {
  const navigate = useNavigate();
  const location = useLocation();
  const project_path = `/dcs-system/project/${project._id}`;
  const is_active = location.pathname === project_path || location.pathname.startsWith(`${project_path}/`);
  // Any project drops open, active or not: looking at a project's forms
  // is not the same as opening the project, and a person should be able to
  // look before they leap. forceExpanded holds it open while searching.
  const [is_expanded_when_active, setIsExpandedWhenActive] = useState(is_active && location.pathname.includes("/forms/"));
  const is_expanded = forceExpanded || is_expanded_when_active;

  const handle_toggle_chevron = () => setIsExpandedWhenActive((prev) => !prev);

  return (
    <div className={`dcs-project-card ${is_active ? "is-active" : ""}`}>
      <div className="flex items-center gap-1 pl-1 pr-2">
        <button onClick={handle_toggle_chevron} className="dcs-project-chevron rounded-full p-1.5 flex-shrink-0 cursor-pointer" aria-label="toggle" aria-expanded={is_expanded}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={is_expanded || is_active ? PRIMARY : "#9E9E9E"}
            strokeWidth="2"
            style={{ transform: is_expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s ease" }}
          >
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={() => {
            navigate(project_path);
            setIsExpandedWhenActive(true);
          }}
          className="dcs-project-card-name flex-1 min-w-0 cursor-pointer flex items-center justify-between gap-2 text-left px-1 py-2.5"
          title={project.name}
          style={{ fontSize: 13, fontWeight: is_active ? 700 : 500, color: is_active ? PRIMARY : "#333333" }}
        >
          <span className="truncate">
            <DcsHighlightedText text={project.name} query={searchQuery} />
          </span>
          <span className="dcs-project-forms-pill flex-shrink-0">{project.forms_count || 0}</span>
        </button>
      </div>
      {is_expanded && <DcsSidebarProjectForms project={project} searchQuery={searchQuery} />}
    </div>
  );
}
