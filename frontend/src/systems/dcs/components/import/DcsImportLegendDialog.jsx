import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsCenterOverlay from "../DcsCenterOverlay.jsx";
import { LINE_COLORS } from "./importMapping.js";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const PRIMARY = "#056daa";
const MUTED = "#9E9E9E";
const RED = "#E74C3C";
const GREEN = "#27AE60";
const TEXT = "#333333";

function Dot({ color, size }) {
  return <span className="inline-block flex-shrink-0" style={{ width: size || 12, height: size || 12, borderRadius: "50%", backgroundColor: color }} />;
}

function Row({ swatch, text }) {
  return (
    <li className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-b-0">
      <span className="flex items-center justify-center flex-shrink-0 w-16 h-6">{swatch}</span>
      <span className="text-sm min-w-0" style={{ color: TEXT, ...FONT }}>
        {text}
      </span>
    </li>
  );
}

export default function DcsImportLegendDialog({ onClose }) {
  const { translate } = useDcsLanguage();

  useEffect(() => {
    const on_key = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", on_key, true);
    return () => document.removeEventListener("keydown", on_key, true);
  }, [onClose]);

  return createPortal(
    <DcsCenterOverlay title={translate("DCS_IMPORT_LEGEND_TITLE")} onClose={onClose} onBackdrop={onClose} maxWidth={560}>
      <ul className="m-0 p-0" style={{ listStyle: "none" }}>
        <Row
          swatch={<span className="inline-flex items-center gap-1">{LINE_COLORS.slice(0, 5).map((color) => <Dot key={color} color={color} size={10} />)}</span>}
          text={translate("DCS_IMPORT_LEGEND_PAIR")}
        />
        <Row swatch={<span className="inline-block" style={{ width: 40, height: 18, border: `2px solid ${PRIMARY}`, backgroundColor: "#EAF4FA" }} />} text={translate("DCS_IMPORT_LEGEND_SELECTED")} />
        <Row swatch={<span className="inline-block" style={{ width: 44, borderTop: `2px dashed ${PRIMARY}` }} />} text={translate("DCS_IMPORT_LEGEND_PENDING")} />
        <Row swatch={<span className="inline-block" style={{ width: 40, height: 18, border: `2px solid ${LINE_COLORS[1]}`, backgroundColor: "#F7F9FB" }} />} text={translate("DCS_IMPORT_LEGEND_HOT")} />
        <Row swatch={<Dot color={MUTED} />} text={translate("DCS_IMPORT_LEGEND_UNMAPPED")} />
        <Row swatch={<span className="text-lg font-bold leading-none" style={{ color: RED }}>*</span>} text={translate("DCS_IMPORT_LEGEND_REQUIRED")} />
        <Row swatch={<Dot color={GREEN} />} text={translate("DCS_IMPORT_LEGEND_GREEN")} />
        <Row
          swatch={<span className="inline-flex items-center justify-center text-[11px] font-bold leading-none" style={{ width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${PRIMARY}`, color: PRIMARY }}>x</span>}
          text={translate("DCS_IMPORT_LEGEND_REMOVE")}
        />
      </ul>
    </DcsCenterOverlay>,
    document.body,
  );
}
