import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsDetailsToggleButton from "./DcsDetailsToggleButton.jsx";

const PRIMARY = "#056daa";
const GRAY = "#9E9E9E";
const NEUTRAL_DARK = "#333333";
const NEUTRAL_LIGHT = "#F7F9FB";
const CARD_BORDER = "rgba(5,109,170,0.35)";
const fontHeading = "'Montserrat', sans-serif";

function PanelRow({ label, value, breakAll }) {
  return (
    <div className="p-3 min-w-0" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${CARD_BORDER}` }}>
      <p className="text-xs font-bold uppercase" style={{ color: GRAY, fontFamily: fontHeading, letterSpacing: 0.5 }}>
        {label}
      </p>
      <p className="text-sm mt-1 font-semibold" style={{ color: NEUTRAL_DARK, overflowWrap: "anywhere", wordBreak: breakAll ? "break-all" : "break-word" }}>
        {value}
      </p>
    </div>
  );
}

export default function DcsApproverPanel({ user, initials, displayName, role, assignedTo, message, onClose, progressNote, settingsSlot }) {
  const { translate } = useDcsLanguage();

  return (
    <div
      className="w-full lg:w-[320px] shrink-0 bg-white h-full flex flex-col relative border-0 lg:border-2 min-[760px]:lg:border-[5px] lg:rounded-none min-[760px]:lg:rounded-[5px]"
      style={{ borderColor: CARD_BORDER }}
    >
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
      <div className="flex items-center gap-3 pb-3" style={{ borderBottom: `2px solid ${CARD_BORDER}` }}>
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-extrabold shrink-0"
          style={{ backgroundColor: PRIMARY, fontFamily: fontHeading }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
            {displayName}
          </p>
          {role && (
            <p className="text-sm font-semibold truncate" style={{ color: PRIMARY, fontFamily: fontHeading }}>
              {role}
            </p>
          )}
        </div>
        {onClose && <DcsDetailsToggleButton isOpen onClick={onClose} small />}
      </div>

      {user && user.telephone && (
        <PanelRow label={translate("DCS_MYAPPROVALS_TELEPHONE")} value={user.telephone} />
      )}
      <PanelRow label={translate("DCS_MYAPPROVALS_EMAIL")} value={(user && user.email) || "-"} breakAll />
      <PanelRow label={translate("DCS_MYAPPROVALS_ASSIGNED_TO")} value={assignedTo} />
      <div className="p-3" style={{ backgroundColor: "rgba(5,109,170,0.06)", border: `2px solid ${PRIMARY}` }}>
        <p className="text-xs font-bold uppercase" style={{ color: PRIMARY, fontFamily: fontHeading, letterSpacing: 0.5 }}>
          {translate("DCS_APPROVAL_MESSAGE_FOR_YOU")}
        </p>
        <p className="text-sm mt-1" style={{ color: NEUTRAL_DARK, overflowWrap: "anywhere" }}>
          {message || translate("DCS_MYAPPROVALS_DEFAULT_MESSAGE")}
        </p>
      </div>

      </div>

      {progressNote && (
        <p
          className="shrink-0 text-xs px-4 py-3 pr-16"
          style={{ color: "#555555", fontFamily: fontHeading, borderTop: `1px solid ${CARD_BORDER}`, backgroundColor: NEUTRAL_LIGHT }}
        >
          {progressNote}
        </p>
      )}

      {settingsSlot}
    </div>
  );
}
