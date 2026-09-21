import React from "react";

const FONT = "'Montserrat', sans-serif";

export default function DcsCenterOverlay({ title, message, accent, children, onBackdrop, maxWidth }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 dcs-no-print">
      <div className="absolute inset-0 bg-black/45" onClick={onBackdrop} />
      <div
        className="relative bg-white border-2 w-full p-5 min-[480px]:p-6 max-h-[90vh] overflow-y-auto"
        style={{ maxWidth: maxWidth || 440, borderColor: accent || "#056daa" }}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <p className="text-base font-bold mb-2 uppercase" style={{ color: accent || "#056daa", fontFamily: FONT, letterSpacing: 0.4 }}>
            {title}
          </p>
        )}
        {message && (
          <p className="text-sm mb-4" style={{ color: "#333333", fontFamily: FONT, whiteSpace: "pre-line" }}>
            {message}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
