import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { dcs_translate, dcs_supported_languages, dcs_default_language } from "./index.js";

const STORAGE_KEY = "dcs_language";

const DcsLanguageContext = createContext(undefined);

/**
 * Reads the previously chosen DCS language from local storage, defaulting
 * to Kinyarwanda when nothing was chosen yet.
 */
function read_stored_language() {
  const stored_value = window.localStorage.getItem(STORAGE_KEY);
  return dcs_supported_languages.includes(stored_value) ? stored_value : dcs_default_language;
}

/**
 * Provides the active DCS language and a translate() helper to the whole
 * data collection system module. Every label anywhere under /dcs-system
 * and /dcs-form flows through this context - there is no hardcoded text.
 */
export function DcsLanguageProvider({ children }) {
  const [language, setLanguageState] = useState(read_stored_language);

  const set_language = useCallback((next_language) => {
    const safe_language = dcs_supported_languages.includes(next_language) ? next_language : dcs_default_language;
    window.localStorage.setItem(STORAGE_KEY, safe_language);
    setLanguageState(safe_language);
  }, []);

  const translate = useCallback((key, vars) => dcs_translate(key, language, vars), [language]);

  const value = useMemo(
    () => ({ language, setLanguage: set_language, translate, supportedLanguages: dcs_supported_languages }),
    [language, set_language, translate],
  );

  return <DcsLanguageContext.Provider value={value}>{children}</DcsLanguageContext.Provider>;
}

/**
 * Hook to read the active DCS language, switch it, and translate keys.
 */
export function useDcsLanguage() {
  const context = useContext(DcsLanguageContext);
  if (context === undefined) {
    throw new Error("useDcsLanguage must be used within a DcsLanguageProvider");
  }
  return context;
}
