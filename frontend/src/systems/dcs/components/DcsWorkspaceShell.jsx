import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsFormNav from "./DcsFormNav.jsx";

const FONT = "'Montserrat', sans-serif";

/**
 * The control that lifts a page over everything else. It is pinned to the
 * right edge of the window rather than sitting in the page's own header:
 * it belongs to the whole page, not to the row of filters above the
 * content, and a page that is scrolled a long way down is exactly where
 * somebody wants more room - so it must still be there, not left behind
 * at the top.
 *
 * Expanding is not the browser's own full screen - it is the page, fixed
 * over the app, so the app's chrome stays a keystroke away and the page
 * keeps its own scrolling.
 */
export function ExpandFab({ expanded, onToggle }) {
  const { translate } = useDcsLanguage();
  const label = translate(expanded ? "DCS_TABLE_FULLSCREEN_CLOSE" : "DCS_TABLE_FULLSCREEN_OPEN");

  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={expanded}
      className={`dcs-expand-fab ${expanded ? "is-active" : ""} cursor-pointer flex items-center justify-center`}
    >
      {/* Frame corners: pushed outward to take the room, drawn back
          inward to give it up. */}
      {expanded ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 4v5H4" />
          <path d="M15 4v5h5" />
          <path d="M9 20v-5H4" />
          <path d="M15 20v-5h5" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9V4h5" />
          <path d="M20 9V4h-5" />
          <path d="M4 15v5h5" />
          <path d="M20 15v5h-5" />
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

/**
 * The frame every page reached from the form's workspace panel sits in:
 * the form's own sub-header links, a heading row, and the content.
 *
 * The heading and its filters sit at the left, where a heading is read
 * from; the content below them is what gets centred, so a wide screen
 * puts the thing being looked at in the middle rather than leaving it
 * stranded against one edge.
 */
export default function DcsWorkspaceShell({ projectId, formGroupId, formName, titleKey, title, toolbar, children }) {
  const { translate } = useDcsLanguage();
  const { expanded, toggle } = useExpandable();

  // Expanding only adds a class to the container that is already there.
  // Moving the page's content into a DIFFERENT wrapper would be a new
  // position in the tree to React, which unmounts everything below it and
  // mounts it again - every fetch redone, every scroll position and open
  // menu lost. The page must survive being expanded untouched.
  return (
    <div className={`h-full flex flex-col pb-4 ${expanded ? "dcs-dt-expanded" : ""}`}>
      <DcsFormNav projectId={projectId} formGroupId={formGroupId} formName={formName} />

      {/* Mobile first: the heading takes the row on its own and the
          filters wrap under it rather than being squeezed beside it. */}
      <div className="dcs-ws-center flex-shrink-0 mb-3 px-1 sm:px-2 flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold uppercase min-w-0 truncate" style={{ color: "#333333", fontFamily: FONT, letterSpacing: "0.4px" }}>
          {title !== undefined ? title : translate(titleKey)}
        </p>
        {toolbar}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="dcs-ws-center">{children}</div>
      </div>

      <ExpandFab expanded={expanded} onToggle={toggle} />
    </div>
  );
}
