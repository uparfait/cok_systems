import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { get_forms_by_project } from "../services/formsService.js";
import { get_cached_forms, remember_forms } from "../hooks/formsCache.js";
import DcsHighlightedText from "./DcsHighlightedText.jsx";

const PRIMARY = "#056daa";
const BADGE_CAP = 99;

function format_badge_count(count) {
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(count || 0);
}

function SidebarFormsSkeleton() {
  return (
    <div className="space-y-2 pl-3" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div key={index} className="animate-pulse h-3" style={{ width: `${80 - index * 14}%`, backgroundColor: "rgba(5,109,170,0.1)" }} />
      ))}
    </div>
  );
}

/**
 * Fetches and renders the list of forms belonging to one project - what an
 * earlier opening fetched shown at once, then silently refreshing every 10
 * seconds - only while this dropdown is actually
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
  // Opening a row a second time shows the forms it showed the first time,
  // at once, and only asks for the fresh list behind them - the skeleton is
  // for a project never opened before.
  const { data: forms, loading } = useSilentPolling(
    () => get_forms_by_project(project._id).then((res) => remember_forms(project._id, res.data || [])),
    10000,
    [project._id],
    { initial: () => get_cached_forms(project._id) },
  );

  return (
    <div className="dcs-project-tree pr-2 pb-2 mb-1 mt-1 space-y-1">
      {loading && <SidebarFormsSkeleton />}
      {!loading && (!forms || forms.length === 0) && (
        <p className="text-xs pl-3" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
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
            className={`dcs-project-leaf ${is_active ? "is-active" : ""} w-full cursor-pointer flex items-center justify-between gap-2 text-left pl-3 pr-2 py-1.5 text-xs`}
            title={title}
            style={{ color: is_active ? PRIMARY : "#555555", fontWeight: is_active ? 700 : 400 }}
          >
            <span className="truncate uppercase">
              <DcsHighlightedText text={title} query={searchQuery} />
            </span>
            <span className="dcs-project-leaf-count flex-shrink-0">{format_badge_count(form.total_submissions)}</span>
          </button>
        );
      })}
    </div>
  );
}
