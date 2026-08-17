import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_submissions } from "../services/submissionsService.js";
import DcsButtonOutline from "./DcsButtonOutline.jsx";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const DANGER = "#E74C3C";

/**
 * Confirms permanently deleting one form version, with an explicit choice
 * over whether its collected submissions are deleted too - shows how many
 * exist so that choice is never made blind. Never shown for the active
 * version - the caller must guarantee that before rendering this.
 */
export default function DcsDeleteVersionDialog({ formGroupId, version, onConfirm, onCancel, deleting }) {
  const { translate } = useDcsLanguage();
  const [submission_count, setSubmissionCount] = useState(null);
  const [delete_data, setDeleteData] = useState(false);

  useEffect(() => {
    let is_mounted = true;
    get_submissions(formGroupId, version, 1, 1)
      .then((response) => {
        if (is_mounted) setSubmissionCount(response.total || 0);
      })
      .catch(() => {
        if (is_mounted) setSubmissionCount(0);
      });
    return () => {
      is_mounted = false;
    };
  }, [formGroupId, version]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={deleting ? undefined : onCancel} />
      <div className="relative bg-white border-2 w-full p-6" style={{ maxWidth: 420, borderColor: DANGER }}>
        <p className="text-base font-semibold mb-2" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
          {translate("DCS_DELETE_VERSION_TITLE", { version })}
        </p>
        <p className="text-sm mb-4" style={{ color: "#555555" }}>
          {translate("DCS_DELETE_VERSION_MESSAGE")}
        </p>

        <label className="flex items-start gap-2 text-sm mb-6" style={{ color: "#333333" }}>
          <input
            type="checkbox"
            checked={delete_data}
            disabled={submission_count === null}
            onChange={(event) => setDeleteData(event.target.checked)}
            style={{ accentColor: DANGER, marginTop: 2 }}
          />
          <span>
            {submission_count === null
              ? translate("DCS_DELETE_VERSION_DATA_CHECKING")
              : translate("DCS_DELETE_VERSION_DATA_CHECKBOX", { count: submission_count })}
          </span>
        </label>

        {deleting ? (
          <SpiralLoader />
        ) : (
          <div className="flex gap-3">
            <DcsButtonOutline className="flex-1" onClick={onCancel}>
              {translate("DCS_NO")}
            </DcsButtonOutline>
            <DcsButtonPrimary
              className="flex-1"
              onClick={() => onConfirm(delete_data)}
              style={{ backgroundColor: DANGER, borderColor: DANGER }}
            >
              {translate("DCS_BTN_DELETE")}
            </DcsButtonPrimary>
          </div>
        )}
      </div>
    </div>
  );
}
