import React, { useEffect, useRef, useState } from "react";
import DcsProjectsSidebar from "./DcsProjectsSidebar.jsx";
import DcsFormSidebar from "./DcsFormSidebar.jsx";
import { useContextNav } from "./contextNav.jsx";

const SIDEBAR_WIDTH_PX = 256;
const FORM_SIDEBAR_WIDTH_PX = 212;
// Below this the two panels can no longer both sit beside the content, so
// the form panel becomes an overlay the way the main sidebar already is.
const BOTH_PANELS_MIN_WIDTH_PX = 1100;
// Matches .dcs-sidebar-drawer's own width transition in globals.css, plus
// a small margin.
const DRAWER_TRANSITION_MS = 360;

/**
 * The projects sidebar is a real flex item whose own width animates
 * between 0 and its full size - never an overlay floating on top of the
 * page - so opening it visibly pushes and resizes the main content next to
 * it instead of covering it. Whether it is open is not its own to decide:
 * the shell holds that, because the button that opens and closes it sits up
 * in the sub-header, where the main sidebar's own menu button sits. It
 * starts open.
 *
 * While a FORM is open a second panel sits right beside it, carrying that
 * form's whole workspace (its table, gallery, dashboard, downloads,
 * sharing, TDM, versions, ownership and approval scheduling). On a wide
 * screen it is another flex item, so both panels and the content share
 * the row; below BOTH_PANELS_MIN_WIDTH_PX there is no room for three
 * columns, so it floats over the content instead and closes as soon as a
 * link in it is followed - the mobile-first behaviour the projects
 * sidebar's own button already has.
 *
 * The panel's own width is set in CSS (.dcs-sidebar-panel), not here: on a
 * pointer device wide enough for it, hovering the open sidebar widens the
 * panel to whatever its longest project or form name actually needs, and
 * that has to be an intrinsic width no inline pixel value can express.
 * It grows OVER the main content rather than pushing it, so a passing
 * mouse never reflows the page.
 */
export default function DcsSidebarShell({ children, onMainScroll, projects, projectsLoading, isOpen, onClose, onPeek }) {
  // The track only clips the panel while its own width is still animating
  // open or closed. Once it has settled open it stops clipping, so the
  // panel's hover width can animate BOTH ways in full view - clipping it
  // again the instant the pointer leaves would cut the shrink off after a
  // few pixels and read as an instant snap back.
  const [is_track_clipping, setIsTrackClipping] = useState(true);
  const [is_wide, setIsWide] = useState(() => window.innerWidth >= BOTH_PANELS_MIN_WIDTH_PX);
  const [is_form_panel_open, setIsFormPanelOpen] = useState(false);
  // A closed sidebar still answers the edge of the screen: resting the
  // pointer on the strip it leaves behind opens it exactly as the menu
  // does, and it closes again when the pointer leaves - unless the menu was
  // what opened it, in which case only the menu closes it.
  const opened_by_hover = useRef(false);
  const clipping_timeout_ref = useRef(null);
  const panel_ref = useRef(null);

  const nav = useContextNav();
  const form_nav = nav && nav.kind === "form" && nav.project_id && nav.form_group_id ? nav : null;

  useEffect(() => {
    setIsTrackClipping(true);
    if (clipping_timeout_ref.current) window.clearTimeout(clipping_timeout_ref.current);
    if (isOpen) clipping_timeout_ref.current = window.setTimeout(() => setIsTrackClipping(false), DRAWER_TRANSITION_MS);
    return () => {
      if (clipping_timeout_ref.current) window.clearTimeout(clipping_timeout_ref.current);
    };
  }, [isOpen]);

  useEffect(() => {
    const measure = () => setIsWide(window.innerWidth >= BOTH_PANELS_MIN_WIDTH_PX);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // A narrow screen never opens the form panel by itself - it would cover
  // the very page the person just navigated to.
  useEffect(() => {
    setIsFormPanelOpen(!!form_nav && is_wide);
  }, [form_nav ? form_nav.form_group_id : "", is_wide]); // eslint-disable-line react-hooks/exhaustive-deps

  const peek_open = () => {
    if (isOpen || !onPeek) return;
    opened_by_hover.current = true;
    onPeek(true);
  };
  const peek_close = () => {
    if (!opened_by_hover.current || !onPeek) return;
    opened_by_hover.current = false;
    onPeek(false);
  };

  const show_form_panel = !!form_nav && is_form_panel_open;

  return (
    <div className="relative flex flex-1 min-h-0">
      {!isOpen && <div className="dcs-sidebar-peek" onMouseEnter={peek_open} />}
      <div
        className={`dcs-sidebar-drawer h-full flex-shrink-0 ${is_track_clipping ? "overflow-hidden" : ""}`}
        style={{ width: isOpen ? SIDEBAR_WIDTH_PX : 0 }}
        onMouseLeave={peek_close}
      >
        <div className="dcs-sidebar-panel" ref={panel_ref}>
          <DcsProjectsSidebar projects={projects} loading={projectsLoading} onClose={onClose} />
        </div>
      </div>

      {/* The form's own workspace panel: a flex item beside the projects
          sidebar when there is room for three columns, a panel floating
          over the content when there is not. */}
      {form_nav && (
        <div
          className={`dcs-form-ws-drawer h-full flex-shrink-0 ${show_form_panel ? "is-open" : ""} ${is_wide ? "" : "is-floating"}`}
          style={is_wide ? { width: show_form_panel ? FORM_SIDEBAR_WIDTH_PX : 0 } : { width: show_form_panel ? FORM_SIDEBAR_WIDTH_PX : 0 }}
        >
          <div className="dcs-form-ws-panel" style={{ width: FORM_SIDEBAR_WIDTH_PX }}>
            <DcsFormSidebar nav={form_nav} onClose={is_wide ? undefined : () => setIsFormPanelOpen(false)} />
          </div>
        </div>
      )}

      {form_nav && !is_wide && show_form_panel && (
        <div className="dcs-form-ws-backdrop" onClick={() => setIsFormPanelOpen(false)} />
      )}

      {/* On a narrow screen the panel is reached from a tab pinned to the
          left edge of the content, since there is no room to keep it open. */}
      {form_nav && !is_wide && !show_form_panel && (
        <button
          type="button"
          onClick={() => setIsFormPanelOpen(true)}
          title={form_nav.title}
          aria-label={form_nav.title}
          className="dcs-form-ws-tab cursor-pointer flex items-center justify-center"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      )}

      <main className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-4 lg:p-6" onScroll={onMainScroll}>
        {children}
      </main>
    </div>
  );
}
