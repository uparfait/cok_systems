import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";
import DcsButtonOutlineDanger from "./DcsButtonOutlineDanger.jsx";
import DcsConfirmDialog from "./DcsConfirmDialog.jsx";

const STATUS_LABEL_KEYS = {
  pending: "DCS_QUEUE_STATUS_PENDING",
  error: "DCS_QUEUE_STATUS_ERROR",
};

const STATUS_COLORS = {
  pending: "#056daa",
  error: "#E74C3C",
};

function InlineSpinner({ color }) {
  return <span className="dcs-inline-spinner" style={{ color }} />;
}

/**
 * Every response saved for this form, split exactly the way they're
 * stored: the one in-progress draft (if any), and the separate list of
 * completed responses waiting to upload. Clicking a queued record loads it
 * back into the form to review or fix; the draft has its own Continue/
 * Delete actions instead of living in that same list, since it is not a
 * response at all yet.
 */
export default function DcsQueuePanel({
  records,
  draft,
  isOnline,
  isSyncing,
  onClose,
  onSelectRecord,
  onContinueDraft,
  onDeleteDraft,
  onUpload,
  onExportReady,
}) {
  const { translate } = useDcsLanguage();
  const total_count = records.length;
  const ready_count = records.filter((record) => record.status === "pending").length;
  // Every button below fires exactly one of these keys while its own
  // action is in flight, so each one can show its own loading state and
  // the rest of the panel simply disables until it resolves - two clicks
  // on two different actions at once would race each other against the
  // same underlying queue.
  const [loading_action, setLoadingAction] = useState(null);
  const is_busy = loading_action !== null;
  // A draft was never finished, so discarding it only needs a plain "are
  // you sure" confirmation.
  const [draft_delete_pending, setDraftDeletePending] = useState(false);

  const run_action = (action_key, action_fn) => async () => {
    setLoadingAction(action_key);
    try {
      await action_fn();
    } finally {
      setLoadingAction(null);
    }
  };

  const confirm_delete_draft = run_action("delete_draft", async () => {
    await onDeleteDraft();
    setDraftDeletePending(false);
  });

  return (
    <div className="fixed inset-0 z-[10000] flex dcs-no-print">
      <div className="absolute inset-0 dcs-queue-backdrop" onClick={onClose} />
      <div
        className="dcs-queue-panel-enter relative bg-white w-full max-w-sm h-full flex flex-col shadow-lg"
        style={{ backgroundColor: "#F7F9FB" }}
      >
        <div className="cok-bg-primary px-4 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-white font-semibold uppercase tracking-wide text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_QUEUE_TITLE")}
          </span>
          <button
            type="button"
            onClick={onClose}
            title={translate("DCS_BTN_CLOSE")}
            className="cursor-pointer flex items-center justify-center"
            style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.6)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className="text-xs" style={{ color: "#555555", fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_QUEUE_DESCRIPTION")}
          </p>

          <div className="bg-white border-2 p-3 space-y-2" style={{ borderColor: "#E0E0E0" }}>
            <div className="flex items-center gap-2" title={translate(isOnline ? "DCS_QUEUE_STATUS_ONLINE" : "DCS_QUEUE_STATUS_OFFLINE")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isOnline ? "#4CAF50" : "#E74C3C"} strokeWidth="2">
                <path d="M2 8.5a15 15 0 0120 0" />
                <path d="M5.5 12.5a10 10 0 0113 0" />
                <path d="M9 16.5a5 5 0 016 0" />
                <circle cx="12" cy="20" r="1" fill={isOnline ? "#4CAF50" : "#E74C3C"} stroke="none" />
                {!isOnline && <line x1="3" y1="3" x2="21" y2="21" />}
              </svg>
            </div>
            <div className="flex items-center justify-between text-sm" style={{ color: "#555555" }}>
              <span>{translate("DCS_QUEUE_TOTAL_SAVED")}</span>
              <span className="font-semibold" style={{ color: "#333333" }}>{total_count}</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase mb-2" style={{ color: "#9E9E9E", letterSpacing: "0.5px" }}>
              {translate("DCS_QUEUE_DRAFT_SECTION_TITLE")}
            </p>
            {draft ? (
              <div className="bg-white border-2 p-3 space-y-2" style={{ borderColor: "#E0E0E0" }}>
                <p className="text-xs" style={{ color: "#555555", fontFamily: "'Montserrat', sans-serif" }}>
                  {new Date(draft.updated_at).toLocaleString()}
                </p>
                <div className="flex gap-2">
                  <DcsButtonOutline className="flex-1" onClick={run_action("continue_draft", onContinueDraft)} disabled={is_busy}>
                    {loading_action === "continue_draft" ? <InlineSpinner color="#056daa" /> : translate("DCS_BTN_CONTINUE_DRAFT")}
                  </DcsButtonOutline>
                  <DcsButtonOutlineDanger onClick={() => setDraftDeletePending(true)} disabled={is_busy}>
                    {loading_action === "delete_draft" ? <InlineSpinner color="#E74C3C" /> : translate("DCS_BTN_DELETE")}
                  </DcsButtonOutlineDanger>
                </div>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
                {translate("DCS_QUEUE_NO_DRAFT")}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase mb-2" style={{ color: "#9E9E9E", letterSpacing: "0.5px" }}>
              {translate("DCS_QUEUE_TO_SUBMIT_SECTION_TITLE")}
            </p>
            {total_count === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
                {translate("DCS_QUEUE_EMPTY")}
              </p>
            ) : (
              <div className="space-y-2">
                {records.map((record) => (
                  <div key={record.id} className="bg-white border p-3 space-y-2" style={{ borderColor: "#E0E0E0" }}>
                    <button type="button" onClick={() => onSelectRecord(record)} className="w-full text-left cursor-pointer" disabled={is_busy}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs" style={{ color: "#555555", fontFamily: "'Montserrat', sans-serif" }}>
                          {new Date(record.updated_at || record.created_at).toLocaleString()}
                        </span>
                        <span
                          className="text-xs font-semibold uppercase px-2 py-0.5"
                          style={{ color: "#FFFFFF", backgroundColor: STATUS_COLORS[record.status] || "#9E9E9E", flexShrink: 0 }}
                        >
                          {translate(STATUS_LABEL_KEYS[record.status] || "DCS_QUEUE_STATUS_PENDING")}
                        </span>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2">
            <DcsButtonPrimary className="w-full" onClick={run_action("upload", onUpload)} disabled={is_busy || isSyncing || ready_count === 0 || !isOnline}>
              {loading_action === "upload" || isSyncing ? <InlineSpinner color="#FFFFFF" /> : translate("DCS_BTN_UPLOAD")}
            </DcsButtonPrimary>
            <DcsButtonOutline className="w-full" onClick={run_action("export", onExportReady)} disabled={is_busy || ready_count === 0}>
              {loading_action === "export" ? <InlineSpinner color="#056daa" /> : translate("DCS_BTN_EXPORT_READY")}
            </DcsButtonOutline>
          </div>

          <div className="space-y-2 pt-2 border-t" style={{ borderColor: "#E0E0E0" }}>
            <p className="text-xs" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
              {translate("DCS_QUEUE_AUTO_UPLOAD_NOTE")}
            </p>
            <p className="text-xs" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
              {translate("DCS_QUEUE_FORCE_UPLOAD_NOTE")}
            </p>
          </div>
        </div>
      </div>

      {draft_delete_pending && (
        <DcsConfirmDialog
          titleKey="DCS_DELETE_DRAFT_CONFIRM_TITLE"
          messageKey="DCS_DELETE_DRAFT_CONFIRM_MESSAGE"
          confirming={loading_action === "delete_draft"}
          onConfirm={confirm_delete_draft}
          onCancel={() => setDraftDeletePending(false)}
        />
      )}
    </div>
  );
}
