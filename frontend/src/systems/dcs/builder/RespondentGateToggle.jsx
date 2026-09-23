import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const PRIMARY = "#056daa";
const MUTED = "#9E9E9E";
const FONT = "'Montserrat', sans-serif";

/**
 * Whether the public form first asks who is filling it in (the name,
 * email and phone card - DcsRespondentGate). On by default; the animated
 * switch turns it off for a form that should open straight on its
 * questions. Saved with the form as ask_respondent.
 */
export default function RespondentGateToggle({ value, onChange, disabled }) {
  const { translate } = useDcsLanguage();
  const on = value !== false;
  return (
    <div className="dcs-tracking-bar">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={translate("DCS_RESPONDENT_GATE_TITLE")}
        className="dcs-switch"
        onClick={() => onChange(!on)}
        disabled={disabled}
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase truncate" style={{ color: on ? PRIMARY : MUTED, fontFamily: FONT, letterSpacing: 0.5 }}>
          {translate("DCS_RESPONDENT_GATE_TITLE")}
        </p>
        <p className="text-xs" style={{ color: MUTED, fontFamily: FONT }}>
          {translate(on ? "DCS_RESPONDENT_GATE_ON_HINT" : "DCS_RESPONDENT_GATE_OFF_HINT")}
        </p>
      </div>
    </div>
  );
}
