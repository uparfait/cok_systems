import React, { useState } from "react";
import DcsProjectsSidebar from "./DcsProjectsSidebar.jsx";
import DcsSidebarToggleIcon from "../components/DcsSidebarToggleIcon.jsx";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const SIDEBAR_WIDTH_PX = 256;
const TOGGLE_SIZE_PX = 34;

/**
 * The projects sidebar is a real flex item whose own width animates
 * between 0 and its full size - never an overlay floating on top of the
 * page - so opening it visibly pushes and resizes the main content next to
 * it instead of covering it. The toggle button rides along the sidebar's
 * own trailing edge, straddling the boundary line so it always sits right
 * where the sidebar currently ends, whether that's the far left (closed)
 * or past the open drawer.
 */
export default function DcsSidebarShell({ children, onMainScroll }) {
  const { translate } = useDcsLanguage();
  const [is_sidebar_open, setIsSidebarOpen] = useState(false);

  return (
    <div className="relative flex flex-1 min-h-0">
      <div
        className="dcs-sidebar-drawer h-full flex-shrink-0 overflow-hidden"
        style={{ width: is_sidebar_open ? SIDEBAR_WIDTH_PX : 0 }}
      >
        <div style={{ width: SIDEBAR_WIDTH_PX, height: "100%" }}>
          <DcsProjectsSidebar />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsSidebarOpen((previous) => !previous)}
        title={translate(is_sidebar_open ? "DCS_SIDEBAR_HIDE" : "DCS_SIDEBAR_SHOW")}
        className="dcs-sidebar-toggle absolute z-30 cursor-pointer flex items-center justify-center bg-white border"
        style={{
          top: 12,
          left: is_sidebar_open ? SIDEBAR_WIDTH_PX - TOGGLE_SIZE_PX / 2 : 12,
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
