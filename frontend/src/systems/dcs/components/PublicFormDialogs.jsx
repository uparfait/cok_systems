import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsCenterOverlay from "./DcsCenterOverlay.jsx";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";
import DcsButtonOutlineDanger from "./DcsButtonOutlineDanger.jsx";

const AMBER = "#B9770E";

/** Asks whether to pick the saved, unfinished draft back up or throw it away. */
export function ResumeDraftDialog({ draft, submitting, onResume, onDiscard }) {
  const { translate } = useDcsLanguage();
  return (
    <DcsCenterOverlay title={translate("DCS_PUBLIC_RESUME_DRAFT_TITLE")} message={translate("DCS_PUBLIC_RESUME_DRAFT_MESSAGE", { date: new Date(draft.updated_at).toLocaleString() })}>
      <div className="flex flex-col min-[480px]:flex-row gap-2">
        <DcsButtonPrimary className="flex-1" onClick={onResume} disabled={submitting}>
          {translate("DCS_BTN_CONTINUE_DRAFT")}
        </DcsButtonPrimary>
        <DcsButtonOutlineDanger className="flex-1" onClick={onDiscard} disabled={submitting}>
          {translate("DCS_BTN_DISCARD_DRAFT")}
        </DcsButtonOutlineDanger>
      </div>
    </DcsCenterOverlay>
  );
}

/** Tells the respondent plainly that the response is saved on the device, not sent yet. */
export function QueuedNoticeDialog({ message, onUnderstood, onOpenQueue }) {
  const { translate } = useDcsLanguage();
  return (
    <DcsCenterOverlay accent={AMBER} title={translate("DCS_PUBLIC_QUEUED_TITLE")} message={message}>
      <div className="flex flex-col min-[480px]:flex-row gap-2">
        <DcsButtonPrimary className="flex-1" onClick={onUnderstood}>
          {translate("DCS_PUBLIC_QUEUED_UNDERSTOOD")}
        </DcsButtonPrimary>
        <DcsButtonOutline className="flex-1" onClick={onOpenQueue}>
          {translate("DCS_QUEUE_BUTTON_LABEL")}
        </DcsButtonOutline>
      </div>
    </DcsCenterOverlay>
  );
}
