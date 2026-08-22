import React, { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../core/contexts/AuthContext";
import Sidebar from "../../../core/components/Layout/Sidebar";
import { getNavigationByPermissions, toSidebarLinks } from "../../../core/components/Layout/layoutUtils";
import { DcsLanguageProvider } from "../i18n/LanguageContext.jsx";
import DcsHeader from "./DcsHeader.jsx";
import DcsSidebarShell from "./DcsSidebarShell.jsx";
import DcsErrorBoundary from "../components/DcsErrorBoundary.jsx";

// Ignored below this scroll position - right near the top, a tiny
// scroll-down jitter must never hide the bar the instant the page loads.
const SCROLL_HIDE_THRESHOLD_PX = 40;
// A page with only a little scrollable room (most non-home DCS pages) must
// never hide the bar at all - with so little distance to scroll, the
// smallest nudge (or rubber-band bounce at the very bottom) flips scroll
// direction back and forth, which made the bar flicker open/closed
// continuously instead of just staying put. Hiding only kicks in once
// there is genuinely a lot of content to scroll through, like the home
// page.
const MIN_SCROLLABLE_DISTANCE_PX = 300;
// Matches .dcs-sub-header's own longest transition (max-height/transform
// at 0.32s) in globals.css, plus a small margin.
const SUB_HEADER_TRANSITION_MS = 400;

/**
 * Root shell for the whole Data Collection System module: the shared
 * header, the main app's own sidebar (the cross-system nav MainLayout
 * normally shows - DCS bypasses MainLayout entirely, so it's wired up
 * here by hand), the DCS projects sidebar, and the outlet for every
 * nested page.
 *
 * Unlike MainLayout, this main sidebar is never pinned open on desktop -
 * it's always the same overlay-on-top-of-everything behavior MainLayout
 * only uses below its lg breakpoint, at every screen size, and always
 * starts closed. DCS already has its own dedicated projects sidebar
 * doing the "permanent panel" job; a second one permanently reserving
 * space here would just crowd a module meant to feel like its own
 * focused workspace. Header's own hamburger button stays visible at
 * every width to match (see alwaysShowMenuButton on Header.tsx).
 */
export default function DcsShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [is_sub_header_visible, setIsSubHeaderVisible] = useState(true);
  const [is_main_sidebar_open, setIsMainSidebarOpen] = useState(false);
  const is_visible_ref = useRef(true);
  const last_scroll_top_ref = useRef(0);
  // Toggling the sub-header changes DcsSidebarShell's own available height
  // (it's a sibling flex row above it, not an overlay), so <main>'s
  // scrollHeight/clientHeight are still settling for the length of that
  // same CSS transition. Reacting to scroll events during that window read
  // a moving target and could flip the very state that caused it - locking
  // out new scroll-driven decisions until the transition finishes is what
  // actually stops that feedback loop, not just a bigger scroll threshold.
  const is_transitioning_ref = useRef(false);
  const transition_timeout_ref = useRef(null);

  const main_sidebar_links = useMemo(() => toSidebarLinks(getNavigationByPermissions(user)), [user]);
  const user_department = user?.departmentName || user?.department_name || "";

  const handle_main_sidebar_navigate = (path) => {
    navigate(path);
    // Always closes after navigating - this sidebar is always treated as
    // the "small device" overlay case, never the pinned-open desktop one.
    setIsMainSidebarOpen(false);
  };

  const set_sub_header_visible = (next_visible) => {
    if (is_visible_ref.current === next_visible) return;
    is_visible_ref.current = next_visible;
    setIsSubHeaderVisible(next_visible);
    is_transitioning_ref.current = true;
    if (transition_timeout_ref.current) window.clearTimeout(transition_timeout_ref.current);
    transition_timeout_ref.current = window.setTimeout(() => {
      is_transitioning_ref.current = false;
    }, SUB_HEADER_TRANSITION_MS);
  };

  // The scrollable element is <main> inside DcsSidebarShell, not the
  // window - DcsHeader lives outside it entirely, so this is lifted up to
  // their shared parent and threaded down as a plain onScroll handler
  // rather than needing a ref shared across sibling components.
  const handle_main_scroll = (event) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const scrollable_distance = scrollHeight - clientHeight;

    if (is_transitioning_ref.current) {
      last_scroll_top_ref.current = scrollTop;
      return;
    }

    if (scrollable_distance < MIN_SCROLLABLE_DISTANCE_PX) {
      set_sub_header_visible(true);
    } else if (scrollTop > last_scroll_top_ref.current && scrollTop > SCROLL_HIDE_THRESHOLD_PX) {
      set_sub_header_visible(false);
    } else if (scrollTop < last_scroll_top_ref.current) {
      set_sub_header_visible(true);
    }
    last_scroll_top_ref.current = scrollTop;
  };

  useEffect(() => {
    const prevent_default = (event) => event.preventDefault();
    window.addEventListener("dragover", prevent_default);
    window.addEventListener("drop", prevent_default);
    return () => {
      window.removeEventListener("dragover", prevent_default);
      window.removeEventListener("drop", prevent_default);
      if (transition_timeout_ref.current) window.clearTimeout(transition_timeout_ref.current);
    };
  }, []);

  return (
    <DcsErrorBoundary>
      <DcsLanguageProvider>
        <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
          {is_main_sidebar_open && (
            <div className="dcs-main-sidebar-backdrop fixed inset-0 z-30" onClick={() => setIsMainSidebarOpen(false)} />
          )}
          {/* w-64 is deliberate, not decorative - it has to match Sidebar's
              own w-64 exactly. "-translate-x-full" is a percentage of THIS
              element's own width, and with no width set at all here (its
              only children are position:fixed/absolute, which never count
              toward a parent's own shrink-to-fit size) that percentage
              resolved against ~0px - the close button, the backdrop click,
              and the closed-by-default initial state all "worked" in state
              but never actually moved the panel off-screen. */}
          <div
            className={`fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-300 ${
              is_main_sidebar_open ? "translate-x-0" : "-translate-x-full pointer-events-none"
            }`}
          >
            <Sidebar
              isOpen={is_main_sidebar_open}
              onToggle={() => setIsMainSidebarOpen((previous) => !previous)}
              isDesktop={false}
              links={main_sidebar_links}
              currentPath={location.pathname}
              onNavigate={handle_main_sidebar_navigate}
              userDepartment={user_department}
            />
            <button
              type="button"
              onClick={() => setIsMainSidebarOpen(false)}
              title="Close"
              className="dcs-sidebar-toggle cursor-pointer flex items-center justify-center bg-white border absolute"
              style={{ top: 24, left: 224, width: 32, height: 32, borderRadius: "50%", borderColor: "#E0E0E0", zIndex: 60 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2.5">
                <line x1="5" y1="5" x2="19" y2="19" />
                <line x1="19" y1="5" x2="5" y2="19" />
              </svg>
            </button>
          </div>

          <DcsHeader
            subHeaderVisible={is_sub_header_visible}
            onMainMenuToggle={() => setIsMainSidebarOpen((previous) => !previous)}
          />
          <DcsSidebarShell onMainScroll={handle_main_scroll}>
            <Outlet />
          </DcsSidebarShell>
        </div>
      </DcsLanguageProvider>
    </DcsErrorBoundary>
  );
}
