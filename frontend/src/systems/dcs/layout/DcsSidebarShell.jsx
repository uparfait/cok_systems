import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import DcsProjectsSidebar from "./DcsProjectsSidebar.jsx";
import DcsSidebarToggleIcon from "../components/DcsSidebarToggleIcon.jsx";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const SIDEBAR_WIDTH_PX = 256;
const TOGGLE_SIZE_PX = 34;
const TOGGLE_PARKED_LEFT_PX = 12;
// Matches .dcs-sidebar-drawer's own width transition in globals.css, plus
// a small margin.
const DRAWER_TRANSITION_MS = 360;

/**
 * The projects sidebar is a real flex item whose own width animates
 * between 0 and its full size - never an overlay floating on top of the
 * page - so opening it visibly pushes and resizes the main content next to
 * it instead of covering it. The toggle button rides along the sidebar's
 * own trailing edge, straddling the boundary line so it always sits right
 * where the sidebar currently ends, whether that's the far left (closed)
 * or past the open drawer.
 *
 * The panel's own width is set in CSS (.dcs-sidebar-panel), not here: on a
 * pointer device wide enough for it, hovering the open sidebar widens the
 * panel to whatever its longest project or form name actually needs, and
 * that has to be an intrinsic width no inline pixel value can express.
 * It grows OVER the main content rather than pushing it, so a passing
 * mouse never reflows the page.
 */
export default function DcsSidebarShell({ children, onMainScroll, projects, projectsLoading }) {
  const { translate } = useDcsLanguage();
  const [is_sidebar_open, setIsSidebarOpen] = useState(false);
  // The track only clips the panel while its own width is still animating
  // open or closed. Once it has settled open it stops clipping, so the
  // panel's hover width can animate BOTH ways in full view - clipping it
  // again the instant the pointer leaves would cut the shrink off after a
  // few pixels and read as an instant snap back.
  const [is_track_clipping, setIsTrackClipping] = useState(true);
  const clipping_timeout_ref = useRef(null);
  const panel_ref = useRef(null);
  const toggle_ref = useRef(null);

  const handle_toggle = () => {
    const next_open = !is_sidebar_open;
    setIsSidebarOpen(next_open);
    setIsTrackClipping(true);
    if (clipping_timeout_ref.current) window.clearTimeout(clipping_timeout_ref.current);
    if (next_open) {
      clipping_timeout_ref.current = window.setTimeout(() => setIsTrackClipping(false), DRAWER_TRANSITION_MS);
    }
  };

  useEffect(
    () => () => {
      if (clipping_timeout_ref.current) window.clearTimeout(clipping_timeout_ref.current);
    },
    [],
  );

  // The toggle always straddles the sidebar's CURRENT trailing edge, which
  // is not one fixed number: while the sidebar is opening or closing that
  // edge is the track's animating width, and once it has settled open it
  // is the panel's own width, which hovering grows past the track. The
  // panel's hover width is intrinsic (see .dcs-sidebar-panel), so the only
  // way to ride it is to measure it - written straight to the node rather
  // than through state, since this fires on every frame of that width
  // animation. While following the panel the button's own left transition
  // is turned off (is-following): re-easing toward a new target every
  // frame would leave it trailing behind the edge instead of on it.
  useLayoutEffect(() => {
    const panel = panel_ref.current;
    const toggle = toggle_ref.current;
    if (!panel || !toggle) return undefined;

    if (!is_sidebar_open) {
      toggle.classList.remove("is-following");
      toggle.style.left = `${TOGGLE_PARKED_LEFT_PX}px`;
      return undefined;
    }

    if (is_track_clipping) {
      toggle.classList.remove("is-following");
      toggle.style.left = `${SIDEBAR_WIDTH_PX - TOGGLE_SIZE_PX / 2}px`;
      return undefined;
    }

    const place_on_panel_edge = () => {
      toggle.style.left = `${panel.getBoundingClientRect().width - TOGGLE_SIZE_PX / 2}px`;
    };

    toggle.classList.add("is-following");
    place_on_panel_edge();

    if (typeof window.ResizeObserver !== "function") return undefined;
    const observer = new window.ResizeObserver(place_on_panel_edge);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [is_sidebar_open, is_track_clipping]);

  return (
    <div className="relative flex flex-1 min-h-0">
      <div
        className={`dcs-sidebar-drawer h-full flex-shrink-0 ${is_track_clipping ? "overflow-hidden" : ""}`}
        style={{ width: is_sidebar_open ? SIDEBAR_WIDTH_PX : 0 }}
      >
        <div className="dcs-sidebar-panel" ref={panel_ref}>
          <DcsProjectsSidebar projects={projects} loading={projectsLoading} />
        </div>
      </div>

      <button
        type="button"
        ref={toggle_ref}
        onClick={handle_toggle}
        title={translate(is_sidebar_open ? "DCS_SIDEBAR_HIDE" : "DCS_SIDEBAR_SHOW")}
        className="dcs-sidebar-toggle absolute z-30 cursor-pointer flex items-center justify-center bg-white border"
        style={{
          top: 12,
          width: TOGGLE_SIZE_PX,
          height: TOGGLE_SIZE_PX,
          borderRadius: "50%",
          borderColor: "#E0E0E0",
        }}
      >
        <DcsSidebarToggleIcon flipped={is_sidebar_open} />
      </button>

      <main className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-4 lg:p-6" onScroll={onMainScroll}>
        {children}
      </main>
    </div>
  );
}
