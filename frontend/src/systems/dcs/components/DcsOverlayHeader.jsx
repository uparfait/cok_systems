import React from "react";
import OverlayCloseButton from "../../../core/components/overlay/OverlayCloseButton";

const FONT = "'Montserrat', sans-serif";

export default function DcsOverlayHeader({ title, subtitle, onClose, busy, extra }) {
  return (
    <div className="flex items-start gap-3 px-4 min-[480px]:px-5 pt-4 pb-3 border-b border-gray-100 bg-white">
      <div className="min-w-0 flex-1">
        {title ? (
          <h2 className="text-base font-semibold text-gray-900 truncate" style={{ fontFamily: FONT }}>
            {title}
          </h2>
        ) : null}
        {subtitle ? <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div> : null}
      </div>
      {extra}
      {onClose ? <OverlayCloseButton onClick={onClose} disabled={!!busy} /> : null}
    </div>
  );
}
