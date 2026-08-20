import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";

export default function DcsTextLinkMenu({ x, y, initialUrl, onApply, onRemove, onClose }) {
  const { translate } = useDcsLanguage();
  const [url_draft, setUrlDraft] = useState(initialUrl || "https://");
  const menu_ref = useRef(null);

  useEffect(() => {
    const handle_mouse_down = (event) => {
      if (menu_ref.current && !menu_ref.current.contains(event.target)) onClose();
    };
    document.addEventListener("mousedown", handle_mouse_down);
    return () => document.removeEventListener("mousedown", handle_mouse_down);
  }, [onClose]);

  return (
    <div
      ref={menu_ref}
      className="fixed z-[10001] bg-white border shadow-lg p-3"
      style={{ top: y, left: x, width: 240, borderColor: "#E0E0E0" }}
    >
      <input
        autoFocus
        className="cok-auth-input w-full py-2 mb-2"
        value={url_draft}
        onChange={(event) => setUrlDraft(event.target.value)}
        placeholder="https://"
      />
      <div className="flex gap-2">
        <DcsButtonOutline onClick={() => onApply(url_draft)}>{translate("DCS_BTN_LINK")}</DcsButtonOutline>
        <DcsButtonOutline onClick={onRemove}>{translate("DCS_BTN_UNLINK")}</DcsButtonOutline>
      </div>
    </div>
  );
}
