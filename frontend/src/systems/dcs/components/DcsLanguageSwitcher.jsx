import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const LANGUAGE_LABEL_KEYS = { en: "DCS_LANGUAGE_EN", kn: "DCS_LANGUAGE_KN", fr: "DCS_LANGUAGE_FR" };

/**
 * Lets the user switch the active DCS language. Selecting a language
 * re-renders every translated label across the whole module immediately.
 */
export default function DcsLanguageSwitcher({ className }) {
  const { language, setLanguage, translate, supportedLanguages } = useDcsLanguage();

  return (
    <select
      aria-label={translate("DCS_LANGUAGE_LABEL")}
      value={language}
      onChange={(event) => setLanguage(event.target.value)}
      className={className || ""}
      style={{
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 13,
        fontWeight: 600,
        border: "1px solid #E0E0E0",
        borderRadius: 0,
        padding: "0.4rem 0.6rem",
        backgroundColor: "#FFFFFF",
        color: "#333333",
      }}
    >
      {supportedLanguages.map((language_code) => (
        <option key={language_code} value={language_code}>
          {translate(LANGUAGE_LABEL_KEYS[language_code])}
        </option>
      ))}
    </select>
  );
}
