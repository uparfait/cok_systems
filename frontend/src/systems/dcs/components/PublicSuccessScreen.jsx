import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const FONT = "'Montserrat', sans-serif";
const AMBER = "#B9770E";

const TITLE_KEYS = {
  success_submitted: "DCS_PUBLIC_RESPONSE_SAVED_TITLE",
  success_offline: "DCS_PUBLIC_QUEUED_TITLE",
  success_updated: "DCS_TRACKING_UPDATED_TITLE",
};

/**
 * What the public form shows in place of its fields once a response was
 * sent, saved on the device for later, or - on a tracked form - a record
 * was updated. One link starts the next response.
 */
export default function PublicSuccessScreen({ state, queuedMessage, onAnother }) {
  const { translate } = useDcsLanguage();
  const is_offline = state === "success_offline";
  const description = state === "success_updated" ? translate("DCS_TRACKING_UPDATED_DESCRIPTION") : is_offline ? queuedMessage : translate("DCS_PUBLIC_RESPONSE_SAVED_DESCRIPTION");
  return (
    <div className="w-full py-12 flex flex-col items-center text-center gap-3">
      <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, color: is_offline ? AMBER : "#333333", textTransform: "uppercase" }}>
        {translate(TITLE_KEYS[state] || TITLE_KEYS.success_submitted)}
      </span>
      <span style={{ fontFamily: FONT, fontSize: 14, color: "#666666", maxWidth: 460, whiteSpace: "pre-line" }}>{description}</span>
      <button type="button" onClick={onAnother} className="cursor-pointer underline bg-transparent border-0 p-0 mt-2" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: "#056daa" }}>
        {translate(state === "success_updated" ? "DCS_TRACKING_CONTINUE" : "DCS_PUBLIC_SUBMIT_ANOTHER")}
      </button>
    </div>
  );
}
