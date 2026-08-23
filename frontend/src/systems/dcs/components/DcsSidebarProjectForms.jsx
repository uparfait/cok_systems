import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { get_forms_by_project } from "../services/formsService.js";
import DcsHighlightedText from "./DcsHighlightedText.jsx";

const PRIMARY = "#056daa";
const BADGE_CAP = 99;

function format_badge_count(count) {
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(count || 0);
}

function SidebarFormsSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div key={index} className="animate-pulse h-3" style={{ width: `${80 - index * 14}%`, backgroundColor: "rgba(5,109,170,0.1)" }} />
      ))}
    </div>
  );
}

/**
 * Fetches and renders the list of forms belonging to one project, silently
 * refreshing every 10 seconds - only while this dropdown is actually
 * expanded (it only mounts then), so the number of active pollers stays
 * bounded by how many rows the user has actually opened, not by the total
 * project count. Clicking a form navigates to its overview page; the
 * currently open form is highlighted active. Indented further left than
 * its parent project row so the nesting is visually obvious. searchQuery,
 * when set, marks whichever form name(s) it matches instead of this list
 * being filtered down to just the matches - every form still shows.
 */
export default function DcsSidebarProjectForms({ project, searchQuery }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { translate } = useDcsLanguage();
  const { data: forms, loading } = useSilentPolling(
    () => get_forms_by_project(project._id).then((res) => res.data || []),
    10000,
    [project._id],
  );

  return (
    <div className="pl-8 pr-2 pb-2 mt-2 space-y-2">
      {loading && <SidebarFormsSkeleton />}
      {!loading && (!forms || forms.length === 0) && (
        <p className="text-xs" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
          {translate("DCS_FORMS_LIST_EMPTY")}
        </p>
      )}
      {(forms || []).map((form) => {
        const title = form.form_name || form.form_group_id;
        const form_path = `/dcs-system/project/${project._id}/forms/${form.form_group_id}`;
        const is_active = location.pathname.startsWith(form_path);
        return (
          <button
            key={form.form_group_id}
            onClick={() => navigate(form_path)}
            className="w-full cursor-pointer flex items-center justify-between gap-2 text-left pl-3 pr-2 py-2 text-xs transition-transform duration-150 hover:translate-x-1"
            title={title}
            style={{
              color: is_active ? PRIMARY : "#555555",
              fontWeight: is_active ? 700 : 400,
              backgroundColor: is_active ? "rgba(5,109,170,0.02)" : "transparent",
              borderLeft: is_active ? `3px solid ${PRIMARY}` : "3px solid #E0E0E0",
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            <span className="truncate">
              <DcsHighlightedText text={title} query={searchQuery} />
            </span>
            <span className="flex-shrink-0 text-[10px]" style={{ color: is_active ? PRIMARY : "#9E9E9E" }}>
              {format_badge_count(form.total_submissions)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
