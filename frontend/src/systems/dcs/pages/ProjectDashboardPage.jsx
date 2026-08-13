import React from "react";
import DcsUnderDevelopmentPanel from "../components/DcsUnderDevelopmentPanel.jsx";

/**
 * Project dashboard-building tab: shown but still under development.
 */
export default function ProjectDashboardPage() {
  return (
    <div className="pb-16">
      <DcsUnderDevelopmentPanel titleKey="DCS_SECTION_BUILD_DASHBOARD" />
    </div>
  );
}
