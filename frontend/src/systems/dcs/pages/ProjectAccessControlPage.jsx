import React from "react";
import DcsUnderDevelopmentPanel from "../components/DcsUnderDevelopmentPanel.jsx";

/**
 * Project access-control tab: shown but still under development.
 */
export default function ProjectAccessControlPage() {
  return (
    <div className="pb-16">
      <DcsUnderDevelopmentPanel titleKey="DCS_SECTION_ACCESS_CONTROL" />
    </div>
  );
}
