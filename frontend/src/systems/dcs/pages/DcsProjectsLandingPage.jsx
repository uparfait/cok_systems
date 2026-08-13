import React from "react";
import { useNavigate } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";

/**
 * Default view of /dcs-system before any project is selected.
 */
export default function DcsProjectsLandingPage() {
  const { translate } = useDcsLanguage();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <p style={{ color: "#555555" }}>{translate("DCS_LANDING_SUBTITLE")}</p>
      <DcsButtonPrimary onClick={() => navigate("/dcs-system/new-project")}>
        {translate("DCS_SIDEBAR_NEW_PROJECT")}
      </DcsButtonPrimary>
    </div>
  );
}
