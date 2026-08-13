import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

const PRIMARY = "#056daa";

/**
 * Renders the list of forms belonging to one project (fetched by the
 * parent row so the total count can be shown even while collapsed).
 * Clicking a form navigates straight to its details page; the currently
 * open form is highlighted active, matching the usual app sidebar's
 * active-link pattern. Indented further left than its parent project row
 * so the nesting is visually obvious.
 */
export default function DcsSidebarProjectForms({ project, forms }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="pl-8 pr-2 pb-2 space-y-1">
      {(forms || []).map((form) => {
        const title = form.form_name || form.form_group_id;
        const form_path = `/dcs-system/project/${project._id}/forms/${form.form_group_id}`;
        const is_active = location.pathname.startsWith(form_path);
        return (
          <button
            key={form.form_group_id}
            onClick={() => navigate(`${form_path}/details`)}
            className="w-full cursor-pointer text-left pl-3 pr-2 py-1.5 text-xs truncate"
            title={title}
            style={{
              color: is_active ? PRIMARY : "#555555",
              fontWeight: is_active ? 700 : 400,
              backgroundColor: is_active ? "rgba(5,109,170,0.08)" : "transparent",
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
