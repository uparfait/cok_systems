import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";

const PRIMARY = "#056daa";
const MUTED = "#9E9E9E";
const FONT = "'Montserrat', sans-serif";

export function FollowUpModeToggle({ enabled, onChange, disabled, hint }) {
  const { translate } = useDcsLanguage();
  return (
    <div className="dcs-follow-up-bar dcs-no-print">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={translate("DCS_FOLLOW_UP_MODE")}
        className="dcs-switch"
        onClick={() => onChange(!enabled)}
        disabled={disabled}
      />
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase truncate" style={{ color: enabled ? PRIMARY : MUTED, fontFamily: FONT, letterSpacing: 0.5 }}>
          {translate("DCS_FOLLOW_UP_MODE")}
        </p>
        <p className="text-xs" style={{ color: MUTED, fontFamily: FONT }}>
          <span className="font-bold" style={{ color: enabled ? PRIMARY : "#333333" }}>{translate(enabled ? "DCS_FOLLOW_UP_ENABLED" : "DCS_FOLLOW_UP_DISABLED")}</span>
          {" - "}
          {hint || translate(enabled ? "DCS_FOLLOW_UP_ON_HINT" : "DCS_FOLLOW_UP_OFF_HINT")}
        </p>
      </div>
    </div>
  );
}

export function UpdateRetryNotice({ message, onRetry }) {
  const { translate } = useDcsLanguage();
  if (!message) return null;
  return (
    <div className="dcs-follow-up-notice is-error dcs-no-print" role="alert">
      <p className="text-xs" style={{ color: "#E74C3C", fontFamily: FONT }}>{message}</p>
      <DcsButtonOutline onClick={onRetry}>{translate("DCS_TRACKING_RETRY")}</DcsButtonOutline>
    </div>
  );
}

export function KeyExistsNotice({ notice, onOpen }) {
  const { translate } = useDcsLanguage();
  if (!notice) return null;
  return (
    <div className="dcs-follow-up-notice dcs-no-print" role="status">
      <p className="text-xs" style={{ color: "#8A6D3B", fontFamily: FONT }}>
        {notice.message || translate("DCS_TRACKING_KEY_EXISTS", { field: translate("DCS_TRACKING_KEY_LABEL") })}
      </p>
      <button type="button" className="text-xs font-bold underline cursor-pointer bg-transparent border-0 p-0" style={{ color: PRIMARY, fontFamily: FONT }} onClick={onOpen}>
        {translate("DCS_FOLLOW_UP_OPEN")}
      </button>
    </div>
  );
}
