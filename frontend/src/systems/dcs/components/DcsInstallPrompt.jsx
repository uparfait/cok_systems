import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { detect_platform, is_standalone_display, pending_install_prompt } from "../pwa/dynamicManifest.js";

const FONT = "'Montserrat', sans-serif";

export default function DcsInstallPrompt() {
  const { translate } = useDcsLanguage();
  const [prompt_event, setPromptEvent] = useState(() => pending_install_prompt());
  const [installed, setInstalled] = useState(() => is_standalone_display());
  const [installing, setInstalling] = useState(false);
  const [show_ios_steps, setShowIosSteps] = useState(false);
  const platform = detect_platform();

  useEffect(() => {
    const handle_available = (event) => setPromptEvent((event.detail && event.detail.prompt) || pending_install_prompt());
    const handle_installed = () => setInstalled(true);
    window.addEventListener("pwa-install-available", handle_available);
    window.addEventListener("pwa-installed", handle_installed);
    return () => {
      window.removeEventListener("pwa-install-available", handle_available);
      window.removeEventListener("pwa-installed", handle_installed);
    };
  }, []);

  const handle_install = async () => {
    if (!prompt_event) {
      setShowIosSteps((previous) => !previous);
      return;
    }
    setInstalling(true);
    try {
      await prompt_event.prompt();
      const choice = await prompt_event.userChoice;
      if (choice && choice.outcome === "accepted") setInstalled(true);
    } catch (prompt_error) {
      setPromptEvent(null);
    } finally {
      window.__dcs_install_prompt = null;
      setInstalling(false);
    }
  };

  if (installed) return null;
  if (!prompt_event && platform !== "ios") return null;

  return (
    <div className="flex flex-col gap-2 pt-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs" style={{ color: "#555555", fontFamily: FONT }}>
          {translate("DCS_INSTALL_TITLE")}
        </p>
        <button
          type="button"
          onClick={handle_install}
          disabled={installing}
          title={translate("DCS_INSTALL_BTN")}
          aria-label={translate("DCS_INSTALL_BTN")}
          className="cursor-pointer flex items-center justify-center flex-shrink-0"
          style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #056daa", background: "#FFFFFF", opacity: installing ? 0.6 : 1 }}
        >
          {installing ? (
            <span className="dcs-inline-spinner" style={{ color: "#056daa" }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
        </button>
      </div>
      {show_ios_steps && !prompt_event && (
        <p className="text-xs" style={{ color: "#9E9E9E", fontFamily: FONT }}>
          {translate("DCS_INSTALL_IOS_STEPS")}
        </p>
      )}
    </div>
  );
}
