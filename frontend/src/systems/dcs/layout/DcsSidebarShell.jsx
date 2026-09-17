import React, { useEffect, useRef, useState } from "react";
import DcsProjectsSidebar from "./DcsProjectsSidebar.jsx";

const SIDEBAR_WIDTH_PX = 256;
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
 * The panel's own width is set in CSS (.dcs-sidebar-panel), not here: on a
 * pointer device wide enough for it, hovering the open sidebar widens the
 * panel to whatever its longest project or form name actually needs, and
 * that has to be an intrinsic width no inline pixel value can express.
 * It grows OVER the main content rather than pushing it, so a passing
 * mouse never reflows the page.
 */
export default function DcsSidebarShell({ children, onMainScroll, projects, projectsLoading, isOpen, onClose }) {
  // The track only clips the panel while its own width is still animating
  // open or closed. Once it has settled open it stops clipping, so the
  // panel's hover width can animate BOTH ways in full view - clipping it
  // again the instant the pointer leaves would cut the shrink off after a
  // few pixels and read as an instant snap back.
  const [is_track_clipping, setIsTrackClipping] = useState(true);
  // A closed sidebar still answers the edge of the screen: resting the
  // pointer on the strip it leaves behind opens it exactly as the menu
  // does, and it closes again when the pointer leaves - unless the menu was
  // what opened it, in which case only the menu closes it.
  const opened_by_hover = useRef(false);
  const clipping_timeout_ref = useRef(null);
  const panel_ref = useRef(null);

  useEffect(() => {
    setIsTrackClipping(true);
    if (clipping_timeout_ref.current) window.clearTimeout(clipping_timeout_ref.current);
    if (isOpen) clipping_timeout_ref.current = window.setTimeout(() => setIsTrackClipping(false), DRAWER_TRANSITION_MS);
    return () => {
      if (clipping_timeout_ref.current) window.clearTimeout(clipping_timeout_ref.current);
    };
  }, [isOpen]);

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

      <main className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-4 lg:p-6" onScroll={onMainScroll}>
        {children}
      </main>
    </div>
  );
}
