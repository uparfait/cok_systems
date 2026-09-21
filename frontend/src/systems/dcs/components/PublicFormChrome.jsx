import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const FONT = "'Montserrat', sans-serif";
const TOP_PROGRESS_BAR_HEIGHT_PX = 4;
const TOP_BADGE_OFFSET = `calc(${TOP_PROGRESS_BAR_HEIGHT_PX}px + 8px + env(safe-area-inset-top, 0px))`;
const GLASS_STYLE = {
  backgroundColor: "rgba(255,255,255,0.55)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  border: "1px solid rgba(255,255,255,0.6)",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
};

export default function PublicFormChrome({ progressPercent, isOnline, queueCount, onOpenQueue, disabled, isSyncing, syncKind, fileUploadPercent, storageBackend }) {
  const { translate } = useDcsLanguage();
  const status_color = isOnline ? "#4CAF50" : "#E74C3C";

  return (
    <>
      <div
        className="dcs-no-print"
        title={translate("DCS_RENDERER_PROGRESS_LABEL", { percent: progressPercent })}
        style={{ position: "fixed", top: 0, left: 0, width: "100%", zIndex: 40, backgroundColor: "#E0E0E0" }}
      >
        <div style={{ height: TOP_PROGRESS_BAR_HEIGHT_PX, width: `${progressPercent}%`, backgroundColor: "#056daa", transition: "width 0.3s ease" }} />
      </div>

      <button
        type="button"
        onClick={onOpenQueue}
        disabled={disabled}
        className="dcs-no-print flex items-center justify-center"
        title={translate("DCS_QUEUE_BUTTON_LABEL")}
        style={{
          position: "fixed",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 30,
          backgroundColor: "#056daa",
          border: "none",
          width: 16,
          height: 36,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
          <polyline points="7 5 13 12 7 19" />
          <polyline points="13 5 19 12 13 19" />
        </svg>
      </button>

      <div className="dcs-no-print flex items-center gap-2" style={Object.assign({ position: "fixed", top: TOP_BADGE_OFFSET, left: 26, zIndex: 30, padding: "0.3rem 0.5rem" }, GLASS_STYLE)}>
        <span title={translate(isOnline ? "DCS_QUEUE_STATUS_ONLINE" : "DCS_QUEUE_STATUS_OFFLINE")} className="flex items-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={status_color} strokeWidth="2">
            <path d="M2 8.5a15 15 0 0120 0" />
            <path d="M5.5 12.5a10 10 0 0113 0" />
            <path d="M9 16.5a5 5 0 016 0" />
            <circle cx="12" cy="20" r="1" fill={status_color} stroke="none" />
            {!isOnline && <line x1="3" y1="3" x2="21" y2="21" />}
          </svg>
        </span>
        <span title={translate("DCS_QUEUE_TOTAL_SAVED")} className="flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2">
            <path d="M3 7l9-4 9 4-9 4-9-4z" />
            <path d="M3 12l9 4 9-4" />
            <path d="M3 17l9 4 9-4" />
          </svg>
          <span className="text-xs font-semibold" style={{ color: "#333333", fontFamily: FONT }}>
            {queueCount}
          </span>
        </span>
        {storageBackend === "memory" && (
          <span className="text-xs font-semibold" style={{ color: "#B9770E", fontFamily: FONT }} title={translate("DCS_STORAGE_MEMORY_ONLY")}>
            {translate("DCS_STORAGE_MEMORY_SHORT")}
          </span>
        )}
      </div>

      {isSyncing && isOnline && (
        <div className="dcs-no-print flex items-center gap-2" style={Object.assign({ position: "fixed", bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", left: "50%", transform: "translateX(-50%)", zIndex: 30, padding: "0.5rem 1rem" }, GLASS_STYLE)}>
          <span className="dcs-inline-spinner" style={{ color: "#056daa", flexShrink: 0 }} />
          <span className="text-xs font-semibold" style={{ color: "#056daa", fontFamily: FONT }}>
            {fileUploadPercent !== null
              ? translate("DCS_PUBLIC_UPLOADING_FILES_INDICATOR", { percent: fileUploadPercent })
              : translate(syncKind === "saved" ? "DCS_PUBLIC_SUBMITTING_INDICATOR" : "DCS_PUBLIC_SUBMITTING_DIRECT_INDICATOR")}
          </span>
        </div>
      )}
    </>
  );
}
