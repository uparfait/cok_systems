import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../../../core/components/Layout/Header.tsx";
import DcsLanguageSwitcher from "../components/DcsLanguageSwitcher.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

/**
 * Reuses the same authenticated header every other system uses (profile,
 * notifications, logout), with no sidebar next to it. A slim translated
 * bar underneath carries a back button and the language switcher.
 */
export default function DcsHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { translate } = useDcsLanguage();

  return (
    <div className="flex-shrink-0">
      <Header
        onMenuToggle={() => {}}
        currentSystem={translate("DCS_HEADER_TITLE")}
        links={[]}
        currentPath={location.pathname}
        onNavigate={(path) => navigate(path)}
      />
      <div
        className="flex items-center justify-between px-4 lg:px-6 py-2 border-b"
        style={{ borderColor: "#E0E0E0", backgroundColor: "#F7F9FB" }}
      >
        <DcsButtonOutline onClick={() => navigate(-1)}>{translate("DCS_BTN_BACK")}</DcsButtonOutline>
        <DcsLanguageSwitcher />
      </div>
    </div>
  );
}
