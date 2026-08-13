import React from "react";
import { Outlet } from "react-router-dom";
import { DcsLanguageProvider } from "../i18n/LanguageContext.jsx";
import DcsHeader from "./DcsHeader.jsx";
import DcsSidebarShell from "./DcsSidebarShell.jsx";
import DcsErrorBoundary from "../components/DcsErrorBoundary.jsx";

/**
 * Root shell for the whole Data Collection System module: the shared
 * header (no sidebar of its own) followed by the DCS projects sidebar and
 * its own outlet for every nested page.
 */
export default function DcsShell() {
  return (
    <DcsErrorBoundary>
      <DcsLanguageProvider>
        <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
          <DcsHeader />
          <DcsSidebarShell>
            <Outlet />
          </DcsSidebarShell>
        </div>
      </DcsLanguageProvider>
    </DcsErrorBoundary>
  );
}
