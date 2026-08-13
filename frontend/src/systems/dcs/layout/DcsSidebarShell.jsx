import React from "react";
import DcsProjectsSidebar from "./DcsProjectsSidebar.jsx";

/**
 * Lays out the small projects sidebar next to the page content outlet.
 */
export default function DcsSidebarShell({ children }) {
  return (
    <div className="flex flex-1 min-h-0">
      <DcsProjectsSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-4 lg:p-6">{children}</main>
    </div>
  );
}
