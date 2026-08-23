import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { search_forms } from "../services/formsService.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsSidebarProjectRow from "../components/DcsSidebarProjectRow.jsx";

const SEARCH_DEBOUNCE_MS = 350;

function SkeletonBar({ width }) {
  return <div className="animate-pulse h-4" style={{ width, backgroundColor: "rgba(5,109,170,0.08)" }} />;
}

function ProjectsSkeleton() {
  return (
    <div className="px-3 space-y-3 py-1" aria-hidden="true">
      {[85, 65, 75, 55, 70].map((width, index) => (
        <SkeletonBar key={index} width={`${width}%`} />
      ))}
    </div>
  );
}

// Shown below the (already-visible, name-matched) project rows while the
// debounced forms search is still in flight - a project whose only match
// is a form isn't in the list yet at that point, so this is the only
// indicator that more results may still be about to appear.
function SidebarSearchingSkeleton() {
  return (
    <div className="px-3 space-y-2 py-2 mt-1" aria-hidden="true">
      {[70, 55].map((width, index) => (
        <SkeletonBar key={index} width={`${width}%`} />
      ))}
    </div>
  );
}

/**
 * Small persistent sidebar listing every project. The list itself (data,
 * loading) is polled once by DcsShell and handed down as props, so the
 * header's total projects/forms counts and this list always read the same
 * data instead of two independent pollers drifting apart. "New project"
 * sits below the list, not above it, so it never competes with the title
 * for attention above what's actually the sidebar's main content.
 *
 * The title bar is a search box instead: project names are matched
 * client-side against this already access-filtered list (no extra request
 * needed - narrowing an already-safe set can't expose anything new), while
 * forms aren't preloaded here at all, so matching one by name is a real,
 * debounced backend call that applies the exact same access rules a
 * single project's own form list would.
 *
 * A match is never shown as a separate "results" list - it's the exact
 * same project row every other project uses, with the matching substring
 * marked (DcsHighlightedText) instead of pulled out and explained. A form
 * match shows its parent project with the dropdown forced open (even if
 * that project isn't the active one) so the match sits in its real place
 * among that project's other forms, not floating on its own.
 */
export default function DcsProjectsSidebar({ projects, loading }) {
  const navigate = useNavigate();
  const { translate } = useDcsLanguage();
  const [query, setQuery] = useState("");
  const [form_results, setFormResults] = useState([]);
  const [forms_loading, setFormsLoading] = useState(false);

  const trimmed_query = query.trim();
  const is_searching = trimmed_query.length > 0;

  useEffect(() => {
    if (!is_searching) {
      setFormResults([]);
      setFormsLoading(false);
      return undefined;
    }
    setFormsLoading(true);
    const timeout_id = window.setTimeout(() => {
      search_forms(trimmed_query)
        .then((response) => setFormResults(response.data || []))
        .catch(() => setFormResults([]))
        .finally(() => setFormsLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout_id);
  }, [trimmed_query, is_searching]);

  const matched_form_project_ids = new Set(form_results.map((form) => form.project_id));

  const name_matched_projects = is_searching
    ? (projects || []).filter((project) => project.name.toLowerCase().includes(trimmed_query.toLowerCase()))
    : projects || [];
  const name_matched_ids = new Set(name_matched_projects.map((project) => project._id));

  const form_only_matched_projects = is_searching
    ? (projects || []).filter((project) => matched_form_project_ids.has(project._id) && !name_matched_ids.has(project._id))
    : [];

  const visible_projects = [...name_matched_projects, ...form_only_matched_projects];

  const has_no_results = is_searching && !forms_loading && visible_projects.length === 0;

  return (
    <aside className="w-64 h-full bg-white border-r flex flex-col" style={{ borderColor: "#E0E0E0" }}>
      <div className="p-3 border-b" style={{ borderColor: "#E0E0E0" }}>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={translate("DCS_SIDEBAR_SEARCH_PLACEHOLDER")}
            className="cok-auth-input py-2 text-sm"
            style={{ paddingRight: 30 }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              title={translate("DCS_BTN_CLEAR")}
              className="dcs-sidebar-search-clear absolute cursor-pointer flex items-center justify-center"
              style={{ right: 10, top: "50%", transform: "translateY(-50%)", width: 20, height: 20 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9E9E9E" strokeWidth="2.4" strokeLinecap="round">
                <line x1="5" y1="5" x2="19" y2="19" />
                <line x1="19" y1="5" x2="5" y2="19" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {loading && <ProjectsSkeleton />}

        {!loading && !is_searching && visible_projects.length === 0 && (
          <p className="px-3 text-xs" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_SIDEBAR_NO_PROJECTS")}
          </p>
        )}

        {!loading && visible_projects.length > 0 && (
          <div>
            {visible_projects.map((project) => (
              <DcsSidebarProjectRow
                key={project._id}
                project={project}
                searchQuery={trimmed_query}
                forceExpanded={is_searching && matched_form_project_ids.has(project._id)}
              />
            ))}
          </div>
        )}

        {is_searching && !loading && forms_loading && <SidebarSearchingSkeleton />}

        {has_no_results && (
          <p className="px-3 text-xs" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_SEARCH_NO_RESULTS")}
          </p>
        )}
      </div>

      <div className="p-3 border-t flex-shrink-0" style={{ borderColor: "#E0E0E0" }}>
        <DcsButtonPrimary className="w-full" onClick={() => navigate("/dcs-system/new-project")}>
          {translate("DCS_SIDEBAR_NEW_PROJECT")}
        </DcsButtonPrimary>
      </div>
    </aside>
  );
}
