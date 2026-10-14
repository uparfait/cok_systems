import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_submissions } from "../services/submissionsService.js";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsOverlayHeader from "./DcsOverlayHeader.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const DANGER = "#E74C3C";

/**
 * countSubmissions(version), when given, replaces the form's own record
 * count - the follow-up form counts its own collection.
 */
export default function DcsDeleteVersionDialog({ formGroupId, version, onConfirm, onCancel, deleting, countSubmissions }) {
  const { translate } = useDcsLanguage();
  const [submission_count, setSubmissionCount] = useState(null);
  const [delete_data, setDeleteData] = useState(false);

  useEffect(() => {
    let is_mounted = true;
    const count = countSubmissions ? countSubmissions(version) : get_submissions(formGroupId, version, 1, 1).then((response) => response.total || 0);
    count
      .then((total) => {
        if (is_mounted) setSubmissionCount(total || 0);
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
      <div
        className="relative bg-white border border-gray-200 w-full flex flex-col shadow-xl"
        style={{ maxWidth: 420, borderLeft: `3px solid ${DANGER}` }}
        role="dialog"
        aria-modal="true"
        aria-busy={!!deleting}
      >
        <DcsOverlayHeader title={translate("DCS_DELETE_VERSION_TITLE", { version })} onClose={onCancel} busy={deleting} />
        <div className="px-4 min-[480px]:px-5 py-4">
          <p className="text-sm mb-4" style={{ color: "#555555" }}>
            {translate("DCS_DELETE_VERSION_MESSAGE")}
          </p>

          <label className="flex items-start gap-2 text-sm mb-6" style={{ color: "#333333" }}>
            <input
              type="checkbox"
              checked={delete_data}
              disabled={submission_count === null || deleting}
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
            <DcsButtonPrimary className="w-full" onClick={() => onConfirm(delete_data)} style={{ backgroundColor: DANGER, borderColor: DANGER }}>
              {translate("DCS_BTN_DELETE")}
            </DcsButtonPrimary>
          )}
        </div>
      </div>
    </div>
  );
}
