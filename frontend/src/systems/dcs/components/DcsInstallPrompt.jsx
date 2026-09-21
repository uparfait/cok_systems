import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { apply_form_manifest, detect_platform, is_standalone_display, pending_install_prompt } from "../pwa/dynamicManifest.js";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";

const FONT = "'Montserrat', sans-serif";

function dismiss_key(form_group_id) {
  return `dcs_install_dismissed_${form_group_id}`;
}

function read_dismissed(form_group_id) {
  try {
    return window.localStorage.getItem(dismiss_key(form_group_id)) === "1";
  } catch (storage_error) {
    return false;
  }
}

export default function DcsInstallPrompt({ formGroupId, formName, language }) {
  const { translate } = useDcsLanguage();
  const [prompt_event, setPromptEvent] = useState(() => pending_install_prompt());
  const [dismissed, setDismissed] = useState(() => read_dismissed(formGroupId));
  const [installed, setInstalled] = useState(() => is_standalone_display());
  const [installing, setInstalling] = useState(false);
  const platform = detect_platform();

  useEffect(() => {
    apply_form_manifest({ name: formName, short_name: formName, language });
    const handle_available = (event) => setPromptEvent((event.detail && event.detail.prompt) || pending_install_prompt());
    const handle_installed = () => setInstalled(true);
    window.addEventListener("pwa-install-available", handle_available);
    window.addEventListener("pwa-installed", handle_installed);
    return () => {
      window.removeEventListener("pwa-install-available", handle_available);
      window.removeEventListener("pwa-installed", handle_installed);
    };
  }, [formName, language]);

  const handle_dismiss = () => {
    try {
      window.localStorage.setItem(dismiss_key(formGroupId), "1");
    } catch (storage_error) {
      return setDismissed(true);
    }
    setDismissed(true);
  };

  const handle_install = async () => {
    if (!prompt_event) return;
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

  if (installed || dismissed) return null;
  if (!prompt_event && platform !== "ios") return null;

  return (
    <div className="dcs-no-print w-full min-[760px]:max-w-[700px] bg-white border-2 p-3 mt-3 min-[760px]:mt-0 flex flex-col min-[480px]:flex-row min-[480px]:items-center justify-between gap-3" style={{ borderColor: "#056daa" }}>
      <div className="min-w-0">
        <p className="text-sm font-bold" style={{ color: "#056daa", fontFamily: FONT }}>
          {translate("DCS_INSTALL_TITLE")}
        </p>
        <p className="text-xs mt-1" style={{ color: "#555555", fontFamily: FONT }}>
          {prompt_event ? translate("DCS_INSTALL_HINT") : translate("DCS_INSTALL_IOS_STEPS")}
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {prompt_event && (
          <DcsButtonPrimary onClick={handle_install} disabled={installing}>
            {installing ? translate("DCS_WAITING_GENERIC") : translate("DCS_INSTALL_BTN")}
          </DcsButtonPrimary>
        )}
        <DcsButtonOutline onClick={handle_dismiss} disabled={installing}>
          {translate("DCS_INSTALL_LATER")}
        </DcsButtonOutline>
      </div>
    </div>
  );
}
