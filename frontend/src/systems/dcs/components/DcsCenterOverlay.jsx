import React from "react";
import DcsOverlayHeader from "./DcsOverlayHeader.jsx";

const FONT = "'Montserrat', sans-serif";

export default function DcsCenterOverlay({ title, message, accent, children, onBackdrop, onClose, busy, maxWidth }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 dcs-no-print">
      <div className="absolute inset-0 bg-black/45" onClick={busy ? undefined : onBackdrop} />
      <div
        className="relative bg-white border border-gray-200 w-full max-h-[90vh] flex flex-col shadow-xl"
        style={{ maxWidth: maxWidth || 440, borderLeft: accent ? `3px solid ${accent}` : undefined }}
        role="dialog"
        aria-modal="true"
        aria-busy={!!busy}
      >
        {title ? <DcsOverlayHeader title={title} onClose={onClose} busy={busy} /> : null}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 min-[480px]:px-5 py-4">
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
