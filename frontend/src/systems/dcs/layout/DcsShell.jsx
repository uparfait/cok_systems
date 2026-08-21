import React, { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
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
 * header (no sidebar of its own) followed by the DCS projects sidebar and
 * its own outlet for every nested page.
 */
export default function DcsShell() {
  const [is_sub_header_visible, setIsSubHeaderVisible] = useState(true);
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
          <DcsHeader subHeaderVisible={is_sub_header_visible} />
          <DcsSidebarShell onMainScroll={handle_main_scroll}>
            <Outlet />
          </DcsSidebarShell>
        </div>
      </DcsLanguageProvider>
    </DcsErrorBoundary>
  );
}
