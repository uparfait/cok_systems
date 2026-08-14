import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { get_forms_by_project } from "../services/formsService.js";

const PRIMARY = "#056daa";

/**
 * Fetches and renders the list of forms belonging to one project, silently
 * refreshing every 10 seconds - only while this dropdown is actually
 * expanded (it only mounts then), so the number of active pollers stays
 * bounded by how many rows the user has actually opened, not by the total
 * project count. Clicking a form navigates straight to its details page;
 * the currently open form is highlighted active. Indented further left
 * than its parent project row so the nesting is visually obvious.
 */
export default function DcsSidebarProjectForms({ project }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: forms } = useSilentPolling(
    () => get_forms_by_project(project._id).then((res) => res.data || []),
    10000,
    [project._id],
  );

  return (
    <div className="pl-8 pr-2 pb-2 mt-2 space-y-2">
      {(forms || []).map((form) => {
        const title = form.form_name || form.form_group_id;
        const form_path = `/dcs-system/project/${project._id}/forms/${form.form_group_id}`;
        const is_active = location.pathname.startsWith(form_path);
        return (
          <button
            key={form.form_group_id}
            onClick={() => navigate(`${form_path}/details`)}
            className="w-full cursor-pointer text-left pl-3 pr-2 py-2 text-xs truncate transition-transform duration-150 hover:translate-x-1"
            title={title}
            style={{
              color: is_active ? PRIMARY : "#555555",
              fontWeight: is_active ? 700 : 400,
              backgroundColor: is_active ? "rgba(5,109,170,0.02)" : "transparent",
              borderLeft: is_active ? `3px solid ${PRIMARY}` : "3px solid #E0E0E0",
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            {title}
          </button>
        );
      })}
    </div>
  );
}
