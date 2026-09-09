import React from "react";
import { useOutletContext } from "react-router-dom";
import DashboardPage from "../util-dashboard/DashboardPage.jsx";

/**
 * The form's Dashboard tab: every form owns exactly one dashboard, built
 * and viewed here from the data this form collects.
 */
export default function FormDashboardPage() {
  const { form } = useOutletContext();
  return <DashboardPage form={form} />;
}
