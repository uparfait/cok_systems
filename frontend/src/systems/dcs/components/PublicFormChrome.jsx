import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const FONT = "'Montserrat', sans-serif";
const TOP_PROGRESS_BAR_HEIGHT_PX = 4;
const TOP_BADGE_OFFSET = `calc(${TOP_PROGRESS_BAR_HEIGHT_PX}px + 8px + env(safe-area-inset-top, 0px))`;
const GLASS_STYLE = {
  backgroundColor: "rgba(255,255,255,0.7)",
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
        className="dcs-no-print dcs-queue-edge-tab"
        title={translate("DCS_QUEUE_BUTTON_LABEL")}
        style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
      >
        <span>{translate("DCS_QUEUE_EDGE_LABEL")}</span>
      </button>

      <div className="dcs-no-print flex items-center gap-2 text-xs font-semibold" style={Object.assign({ position: "fixed", top: TOP_BADGE_OFFSET, left: 34, zIndex: 30, padding: "0.3rem 0.6rem", fontFamily: FONT }, GLASS_STYLE)}>
        <span className="flex items-center gap-1" style={{ color: status_color }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: status_color, display: "inline-block" }} />
          {translate(isOnline ? "DCS_QUEUE_STATUS_ONLINE" : "DCS_QUEUE_STATUS_OFFLINE")}
        </span>
        <span style={{ color: "#333333" }} title={translate("DCS_QUEUE_TOTAL_SAVED")}>
          {translate("DCS_QUEUE_SAVED_COUNT", { count: queueCount })}
        </span>
        {storageBackend === "memory" && (
          <span style={{ color: "#B9770E" }} title={translate("DCS_STORAGE_MEMORY_ONLY")}>
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
