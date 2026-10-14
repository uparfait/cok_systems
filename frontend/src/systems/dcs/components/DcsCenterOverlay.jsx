import React from "react";
import DcsOverlayHeader from "./DcsOverlayHeader.jsx";
import { useMediaQuery } from "../util-dashboard/useNarrowViewport.js";

const FONT = "'Montserrat', sans-serif";

/** large: 90vw by 90vh, and the whole screen under 640px. */
export default function DcsCenterOverlay({ title, subtitle, message, accent, children, onBackdrop, onClose, busy, maxWidth, large, headerExtra }) {
  const phone = useMediaQuery("(max-width: 639px)");
  const full = large && phone;
  const panel_style = large
    ? { maxWidth: full ? "100%" : "90vw", width: "100%", height: full ? "100%" : "90vh", maxHeight: full ? "100%" : "90vh", borderLeft: accent ? `3px solid ${accent}` : undefined }
    : { maxWidth: maxWidth || 440, borderLeft: accent ? `3px solid ${accent}` : undefined };
  return (
    <div className={`fixed inset-0 z-[10000] flex items-center justify-center dcs-no-print ${full ? "p-0" : "p-4"}`}>
      <div className="absolute inset-0 bg-black/45" onClick={busy ? undefined : onBackdrop} />
      <div
        className={`relative bg-white border border-gray-200 w-full flex flex-col shadow-xl ${large ? "" : "max-h-[90vh]"}`}
        style={panel_style}
        role="dialog"
        aria-modal="true"
        aria-busy={!!busy}
      >
        {title ? <DcsOverlayHeader title={title} subtitle={subtitle} onClose={onClose} busy={busy} extra={headerExtra} /> : null}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 min-[480px]:px-5 py-4" style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
          {message && (
            <p className="text-sm mb-4" style={{ color: "#333333", fontFamily: FONT, whiteSpace: "pre-line" }}>
              {message}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
