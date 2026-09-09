import React from "react";
import { useOutletContext } from "react-router-dom";
import DashboardPage from "../util-dashboard/DashboardPage.jsx";

/**
 * Project dashboard tab: the full dashboard builder and viewer, backed by
 * live aggregations of the project's collected form data.
 */
export default function ProjectDashboardPage() {
  const { project } = useOutletContext();
  return <DashboardPage project={project} />;
}
