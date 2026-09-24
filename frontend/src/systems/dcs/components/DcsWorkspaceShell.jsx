import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsFormNav from "./DcsFormNav.jsx";

const FONT = "'Montserrat', sans-serif";

/**
 * The frame every page reached from the form's workspace panel sits in:
 * the form's own sub-header links, a title row, and one control that
 * lifts the whole page over everything else.
 *
 * Expanding is not the browser's own full screen - it is this page,
 * fixed over the app, so the app's chrome stays a keystroke away and the
 * page keeps its own scrolling. Escape closes it again, and it closes by
 * itself when the page is left, so a route change can never strand
 * somebody in an expanded view of a page they are no longer on.
 */
export function ExpandToggle({ expanded, onToggle }) {
  const { translate } = useDcsLanguage();
  return (
    <button
      type="button"
      onClick={onToggle}
      title={translate(expanded ? "DCS_TABLE_FULLSCREEN_CLOSE" : "DCS_TABLE_FULLSCREEN_OPEN")}
      aria-label={translate(expanded ? "DCS_TABLE_FULLSCREEN_CLOSE" : "DCS_TABLE_FULLSCREEN_OPEN")}
      aria-pressed={expanded}
      className={`dcs-dt-tool ${expanded ? "is-active" : ""} cursor-pointer flex-shrink-0`}
    >
      {expanded ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="4 14 10 14 10 20" />
          <polyline points="20 10 14 10 14 4" />
          <line x1="14" y1="10" x2="21" y2="3" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      )}
    </button>
  );
}

/**
 * Escape leaves an expanded page, the way it leaves any overlay, and so
 * does going somewhere else - a page that stayed expanded after the route
 * changed under it would cover a page nobody asked to expand.
 */
export function useExpandable() {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();

  useEffect(() => setExpanded(false), [location.pathname]);

  useEffect(() => {
    if (!expanded) return undefined;
    const on_key = (event) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", on_key);
    return () => document.removeEventListener("keydown", on_key);
  }, [expanded]);

  return { expanded, setExpanded, toggle: () => setExpanded((previous) => !previous) };
}

export default function DcsWorkspaceShell({ projectId, formGroupId, formName, titleKey, title, toolbar, children }) {
  const { translate } = useDcsLanguage();
  const { expanded, toggle } = useExpandable();

  const body = (
    <>
      {/* Mobile first: the title takes the row on its own and the
          controls wrap under it rather than being squeezed beside it. */}
      <div className="flex-shrink-0 mb-3 px-1 sm:px-2 flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold uppercase min-w-0 truncate" style={{ color: "#333333", fontFamily: FONT, letterSpacing: "0.4px" }}>
          {title !== undefined ? title : translate(titleKey)}
        </p>
        <span className="flex-1" />
        {toolbar}
        <ExpandToggle expanded={expanded} onToggle={toggle} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </>
  );

  return (
    <div className="h-full flex flex-col pb-4">
      <DcsFormNav projectId={projectId} formGroupId={formGroupId} formName={formName} />
      {expanded ? <div className="dcs-dt-expanded">{body}</div> : body}
    </div>
  );
}
