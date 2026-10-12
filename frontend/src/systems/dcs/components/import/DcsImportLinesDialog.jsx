import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsOverlayHeader from "../DcsOverlayHeader.jsx";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const TEXT = "#333333";
const MUTED = "#9E9E9E";
const ABOVE_WIZARD = 10070;

export default function DcsImportLinesDialog({ title, subtitle, lines, more, onClose }) {
  const { translate } = useDcsLanguage();
  const listed = lines || [];

  useEffect(() => {
    const on_key = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", on_key, true);
    return () => document.removeEventListener("keydown", on_key, true);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center dcs-no-print" style={{ zIndex: ABOVE_WIZARD }}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative bg-white flex flex-col w-full h-full sm:w-[90vw] sm:h-[90vh] shadow-xl" role="dialog" aria-modal="true">
        <DcsOverlayHeader title={title} subtitle={subtitle} onClose={onClose} />
        <div className="flex-1 min-h-0 overflow-y-auto px-4 min-[480px]:px-5 py-4">
          <ol className="space-y-1.5">
            {listed.map((line, index) => (
              <li key={index} className="text-sm" style={{ color: TEXT, overflowWrap: "anywhere", ...FONT }}>
                {index + 1}. {line}
              </li>
            ))}
            {(more || 0) > 0 ? (
              <li className="text-sm" style={{ color: MUTED, ...FONT }}>
                {translate("DCS_IMPORT_ERRORS_MORE", { count: more })}
              </li>
            ) : null}
          </ol>
        </div>
      </div>
    </div>,
    document.body,
  );
}
