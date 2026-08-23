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
 * dropdown forced open regardless of whether it's the active project.
 */
export default function DcsSidebarProjectRow({ project, searchQuery, forceExpanded }) {
  const navigate = useNavigate();
  const location = useLocation();
  const project_path = `/dcs-system/project/${project._id}`;
  const is_active = location.pathname === project_path || location.pathname.startsWith(`${project_path}/`);
  // Only the project that's actually open can drop down its forms - an
  // inactive row can't reveal a list scoped to a project the user isn't
  // even looking at, so its own expanded state is ignored outright the
  // moment it stops being active (derived, not reset - it's remembered in
  // case the same project becomes active again later). forceExpanded
  // overrides this while searching, for a project whose match is a form.
  const [is_expanded_when_active, setIsExpandedWhenActive] = useState(location.pathname.includes("/forms/"));
  const is_expanded = forceExpanded || (is_active && is_expanded_when_active);

  const handle_toggle_chevron = () => {
    if (!is_active) return;
    setIsExpandedWhenActive((prev) => !prev);
  };

  return (
    <div>
      <div className="flex items-center gap-1 pr-2">
        <button
          onClick={handle_toggle_chevron}
          disabled={!is_active}
          className="p-1.5 flex-shrink-0"
          style={{ cursor: is_active ? "pointer" : "default", opacity: is_active ? 1 : 0.35 }}
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
            setIsExpandedWhenActive(true);
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
          <span className="truncate">
            <DcsHighlightedText text={project.name} query={searchQuery} />
          </span>
          <span
            className="flex-shrink-0 text-xs"
            style={{ color: is_active ? PRIMARY : "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}
          >
            {project.forms_count || 0}
          </span>
        </button>
      </div>
      {is_expanded && <DcsSidebarProjectForms project={project} searchQuery={searchQuery} />}
    </div>
  );
}
