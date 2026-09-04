import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_submission_approval_details } from "../services/approvalsService.js";
import DcsApprovalStatusChip from "./DcsApprovalStatusChip.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const BORDER = "#E0E0E0";
const PRIMARY = "#056daa";

/** One approver's line in the trail: who they are, their state, their message and when they acted. */
function ApproverRow({ approver }) {
  const { translate } = useDcsLanguage();
  return (
    <div className="border px-3 py-2.5" style={{ borderColor: BORDER }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-semibold" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
            {approver.name || approver.email}
            {approver.role ? <span style={{ color: "#555555", fontWeight: 400 }}> - {approver.role}</span> : null}
          </p>
          {approver.name && (
            <p className="text-xs" style={{ color: "#9E9E9E" }}>
              {approver.email}
            </p>
          )}
        </div>
        <DcsApprovalStatusChip status={approver.status === "pending" ? "pending" : approver.status} />
      </div>
      {approver.comment && (
        <p className="text-sm mt-2 px-2 py-1.5" style={{ color: "#555555", backgroundColor: "#F7F9FB", borderLeft: `3px solid ${PRIMARY}` }}>
          <span className="text-xs font-bold uppercase" style={{ color: PRIMARY, letterSpacing: "0.5px" }}>
            {translate("DCS_APPROVAL_DETAILS_MESSAGE")}:
          </span>{" "}
          {approver.comment}
        </p>
      )}
      {approver.acted_at && (
        <p className="text-xs mt-1.5" style={{ color: "#9E9E9E" }}>
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
            <p className="text-sm" style={{ color: "#E74C3C" }}>
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
