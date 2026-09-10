import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_submission_approval_details } from "../services/approvalsService.js";
import DcsApprovalStatusChip from "./DcsApprovalStatusChip.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const BORDER = "#E0E0E0";
const PRIMARY = "#056daa";

const GRAY = "#9E9E9E";
const NEUTRAL_DARK = "#333333";
const NEUTRAL_LIGHT = "#F7F9FB";
const SOFT_RED = "#C0564B";
const FONT = "'Montserrat', sans-serif";

function initials_of(approver) {
  const source = (approver.name || approver.email || "?").trim();
  return (
    source
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "?"
  );
}

function MessageBlock({ label, text, accent }) {
  return (
    <div className="mt-2 px-3 py-2" style={{ backgroundColor: NEUTRAL_LIGHT, borderLeft: `3px solid ${accent}` }}>
      <p className="text-[10px] font-bold uppercase" style={{ color: accent, fontFamily: FONT, letterSpacing: 0.5 }}>
        {label}
      </p>
      <p className="text-sm mt-1" style={{ color: NEUTRAL_DARK, overflowWrap: "anywhere" }}>
        {text}
      </p>
    </div>
  );
}

/** One approver: who they are, what they were asked, what they answered. */
function ApproverRow({ approver }) {
  const { translate } = useDcsLanguage();
  const rejected = approver.status === "rejected";
  return (
    <div className="border px-3 py-3" style={{ borderColor: rejected ? "rgba(192,86,75,0.4)" : BORDER }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold text-white shrink-0"
            style={{ backgroundColor: rejected ? SOFT_RED : PRIMARY, fontFamily: FONT }}
          >
            {initials_of(approver)}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: NEUTRAL_DARK, fontFamily: FONT, overflowWrap: "anywhere" }}>
              {approver.name || approver.email}
            </p>
            {approver.role && (
              <p className="text-xs font-semibold" style={{ color: PRIMARY, fontFamily: FONT }}>
                {approver.role}
              </p>
            )}
            {approver.email && approver.name && (
              <p className="text-xs" style={{ color: GRAY, overflowWrap: "anywhere" }}>
                {approver.email}
              </p>
            )}
            {approver.location && approver.location.name && (
              <p className="text-xs" style={{ color: GRAY }}>
                {approver.level_type ? translate(`DCS_APPROVAL_LEVEL_${approver.level_type}`) + " = " : ""}
                {approver.location.name}
              </p>
            )}
          </div>
        </div>
        <DcsApprovalStatusChip status={approver.status === "pending" ? "pending" : approver.status} />
      </div>

      {approver.message && (
        <MessageBlock label={translate("DCS_APPROVAL_MESSAGE_FOR_YOU")} text={approver.message} accent={GRAY} />
      )}
      {approver.comment && (
        <MessageBlock
          label={translate("DCS_APPROVAL_DETAILS_MESSAGE")}
          text={approver.comment}
          accent={rejected ? SOFT_RED : PRIMARY}
        />
      )}

      {approver.acted_at && (
        <p className="text-xs mt-2" style={{ color: GRAY }}>
          {new Date(approver.acted_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

/**
 * Row-click details panel of the data table: everything known about one
 * record's approval - overall state, who approved (with their message and
 * exact time), who is still pending, or the schedule waiting to fire.
 */
export default function DcsApprovalDetailsDialog({ submission_id, onClose }) {
  const { translate } = useDcsLanguage();
  const [details, setDetails] = useState(null);
  const [load_state, setLoadState] = useState("loading");

  useEffect(() => {
    let is_mounted = true;
    setLoadState("loading");
    get_submission_approval_details(submission_id)
      .then((response) => {
        if (!is_mounted) return;
        setDetails(response.data);
        setLoadState("ready");
      })
      .catch(() => {
        if (is_mounted) setLoadState("error");
      });
    return () => {
      is_mounted = false;
    };
  }, [submission_id]);

  const pending_approvers = details ? (details.approvers || []).filter((approver) => approver.status === "pending") : [];
  const acted_approvers = details ? (details.approvers || []).filter((approver) => approver.status !== "pending") : [];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border-2 w-full flex flex-col" style={{ maxWidth: 520, maxHeight: "85vh", borderColor: PRIMARY }}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <p className="text-base font-bold uppercase" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
            {translate("DCS_APPROVAL_DETAILS_TITLE")}
          </p>
          {load_state === "ready" && <DcsApprovalStatusChip status={details.status === "none" ? undefined : details.status} />}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
          {load_state === "loading" && <SpiralLoader />}
          {load_state === "error" && (
            <p className="text-sm" style={{ color: SOFT_RED }}>
              {translate("DCS_ERROR_GENERIC")}
            </p>
          )}

          {load_state === "ready" && details.source === "none" && (
            <p className="text-sm" style={{ color: "#555555" }}>
              {translate("DCS_APPROVAL_DETAILS_NONE")}
            </p>
          )}

          {load_state === "ready" && details.source === "scheduled" && (
            <p className="text-sm mb-3" style={{ color: "#555555" }}>
              {details.trigger && details.trigger.type === "count"
                ? translate("DCS_SCHED_ACTIVE_COUNT", { count: details.trigger.count })
                : translate("DCS_SCHED_ACTIVE_DATETIME", {
                    datetime: details.trigger && details.trigger.datetime ? new Date(details.trigger.datetime).toLocaleString() : "-",
                  })}
            </p>
          )}

          {load_state === "ready" && details.source === "batch" && details.sent_at && (
            <p className="text-xs mb-3" style={{ color: "#9E9E9E" }}>
              {translate("DCS_APPROVAL_DETAILS_SENT_AT")}: {new Date(details.sent_at).toLocaleString()}
              {details.submission_count ? ` - ${translate("DCS_SCHED_RECORDS", { count: details.submission_count })}` : ""}
            </p>
          )}

          {load_state === "ready" && acted_approvers.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {acted_approvers.map((approver, index) => (
                <ApproverRow key={`${approver.email}-${index}`} approver={approver} />
              ))}
            </div>
          )}

          {load_state === "ready" && pending_approvers.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase mb-2" style={{ color: "#F39C12", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
                {translate("DCS_APPROVAL_DETAILS_PENDING")}
              </p>
              <div className="flex flex-col gap-2">
                {pending_approvers.map((approver, index) => (
                  <ApproverRow key={`${approver.email}-${index}`} approver={approver} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-5">
          <DcsButtonOutline className="w-full" onClick={onClose}>
            {translate("DCS_BTN_CLOSE")}
          </DcsButtonOutline>
        </div>
      </div>
    </div>
  );
}
