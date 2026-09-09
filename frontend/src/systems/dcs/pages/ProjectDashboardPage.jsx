import React from "react";
import DcsUnderDevelopmentPanel from "../components/DcsUnderDevelopmentPanel.jsx";

/**
 * Project-level dashboard tab: intentionally empty - dashboards live on
 * each FORM (every form owns its own dashboard, opened from the form's
 * overview or its Dashboard tab).
 */
export default function ProjectDashboardPage() {
  return (
    <div className="pb-16">
      <DcsUnderDevelopmentPanel titleKey="DCS_SECTION_BUILD_DASHBOARD" />
    </div>
  );
}
