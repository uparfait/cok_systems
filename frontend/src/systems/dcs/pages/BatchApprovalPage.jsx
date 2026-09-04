import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { DcsLanguageProvider, useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_batch_approval, verify_batch_approval_otp, submit_batch_approval_decision } from "../services/approvalsService.js";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";
import DcsFormLoadingSpinner from "../components/DcsFormLoadingSpinner.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";
import DcsErrorBoundary from "../components/DcsErrorBoundary.jsx";
import DcsApprovalStatusChip from "../components/DcsApprovalStatusChip.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutlineDanger from "../components/DcsButtonOutlineDanger.jsx";

const PRIMARY = "#056daa";
const BORDER = "#E0E0E0";
const NON_DATA_TYPES = ["section", "paragraph", "header", "file", "group", "image_block", "horizontal_line"];

// One submitted answer displayed read-only; media answers render as links, never re-fetched blobs.
function AnswerValue({ value }) {
  if (value === null || value === undefined || value === "") return <span style={{ color: "#9E9E9E" }}>-</span>;
  if (Array.isArray(value)) return <span>{value.join(", ")}</span>;
  if (typeof value === "object") {
    if (value.url) {
      return (
        <a href={value.url} target="_blank" rel="noreferrer" className="underline" style={{ color: PRIMARY }}>
          {value.name || value.url}
        </a>
      );
    }
    return <span>{value.name || JSON.stringify(value)}</span>;
  }
  return <span>{String(value)}</span>;
}

/** The verified records, one plain scrollable table - fields across, one row per collected response. */
function RecordsTable({ schema, submissions, language }) {
  const { translate } = useDcsLanguage();
  const fields = flatten_fields(schema ? schema.fields : []).filter((field) => !NON_DATA_TYPES.includes(field.type));
  return (
    <div className="overflow-x-auto border" style={{ borderColor: BORDER }}>
      <table className="text-sm" style={{ borderCollapse: "collapse", minWidth: "100%" }}>
        <thead>
          <tr>
            {fields.map((field) => (
              <th key={field.id} className="text-left px-3 py-2 whitespace-nowrap" style={{ backgroundColor: PRIMARY, color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontSize: 12, textTransform: "uppercase" }}>
                {get_field_text(field.label, language) || field.id}
              </th>
            ))}
            <th className="text-left px-3 py-2 whitespace-nowrap" style={{ backgroundColor: PRIMARY, color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontSize: 12, textTransform: "uppercase" }}>
              {translate("DCS_TABLE_SUBMITTED_AT")}
            </th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((submission, row_index) => (
            <tr key={row_index} style={{ backgroundColor: row_index % 2 === 1 ? "#F7F9FB" : "#FFFFFF" }}>
              {fields.map((field) => (
                <td key={field.id} className="px-3 py-2 align-top" style={{ borderBottom: `1px solid ${BORDER}`, color: "#333333" }}>
                  <AnswerValue value={submission.data ? submission.data[field.id] : undefined} />
                </td>
              ))}
              <td className="px-3 py-2 align-top whitespace-nowrap" style={{ borderBottom: `1px solid ${BORDER}`, color: "#555555" }}>
                {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Public batch approver page behind /dcs-batch-approval/:token. The link
 * token identifies the approver; the records only appear after the
 * one-time code from their email is verified, and the same code
 * authorizes the final approve/reject decision.
 */
function BatchApprovalPageContent() {
  const { token } = useParams();
  const { translate, language } = useDcsLanguage();
  const { showSuccess, showError } = useToast();

  const [batch, setBatch] = useState(null);
  const [load_state, setLoadState] = useState("loading");
  const [otp, setOtp] = useState("");
  const [verified, setVerified] = useState(null);
  const [comment, setComment] = useState("");
  const [acting, setActing] = useState(false);
  const [decision_result, setDecisionResult] = useState(null);

  useEffect(() => {
    let is_mounted = true;
    get_batch_approval(token)
      .then((response) => {
        if (!is_mounted) return;
        setBatch(response.data);
        setLoadState("ready");
      })
      .catch(() => {
        if (is_mounted) setLoadState("not_found");
      });
    return () => {
      is_mounted = false;
    };
  }, [token]);

  const handle_verify = async () => {
    if (!otp.trim()) return;
    setActing(true);
    try {
      const response = await verify_batch_approval_otp(token, otp.trim());
      setVerified(response.data);
      showSuccess(response.message || "");
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setActing(false);
    }
  };

  const handle_decide = async (decision) => {
    setActing(true);
    try {
      const response = await submit_batch_approval_decision(token, otp.trim(), decision, comment.trim() || null);
      setDecisionResult(response.data);
      setBatch((previous) =>
        Object.assign({}, previous, {
          overall_status: response.data.overall_status,
          approver: Object.assign({}, previous.approver, { status: response.data.decision }),
          trail: response.data.trail,
        }),
      );
      showSuccess(response.message || "");
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setActing(false);
    }
  };

  if (load_state === "loading") return <DcsFormLoadingSpinner />;
  if (load_state === "not_found") return <DcsEmptyState messageKey="DCS_APPROVAL_NOT_FOUND" />;

  const can_act = batch.approver.status === "pending" && !batch.otp_locked && !decision_result;

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "#F7F9FB" }}>
      <div className="mx-auto bg-white border-2 p-6" style={{ maxWidth: 980, borderColor: BORDER }}>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
          <h1 className="text-xl font-bold" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_BATCH_TITLE")}
          </h1>
          <DcsApprovalStatusChip status={batch.overall_status} />
        </div>
        <p className="text-sm mb-1" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
          <strong>{batch.form_name}</strong>
        </p>
        <p className="text-sm mb-4" style={{ color: "#555555" }}>
          {translate("DCS_BATCH_RECORDS_WAITING", { count: batch.submission_count })}
        </p>

        {batch.otp_locked && (
          <p className="text-sm px-3 py-2 mb-4" style={{ backgroundColor: "rgba(231,76,60,0.1)", color: "#E74C3C" }}>
            {translate("DCS_BATCH_OTP_LOCKED")}
          </p>
        )}

        {batch.approver.status !== "pending" && !decision_result && (
          <p className="text-sm px-3 py-2 mb-4" style={{ backgroundColor: "#F7F9FB", color: "#555555" }}>
            {translate("DCS_BATCH_ALREADY_ACTED")}
          </p>
        )}

        {can_act && !verified && (
          <div className="mb-5">
            <p className="text-sm font-semibold mb-2" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
              {translate("DCS_BATCH_OTP_LABEL")}
            </p>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="border px-3"
                style={{ borderColor: BORDER, height: 44, width: 160, fontFamily: "'Montserrat', sans-serif", fontSize: 20, letterSpacing: 6, textAlign: "center" }}
              />
              <DcsButtonPrimary onClick={handle_verify} disabled={acting || otp.length < 6}>
                {translate("DCS_BATCH_OTP_VERIFY")}
              </DcsButtonPrimary>
            </div>
          </div>
        )}

        {can_act && verified && (
          <>
            <div className="mb-5">
              <RecordsTable schema={verified.schema} submissions={verified.submissions || []} language={language} />
            </div>

            <p className="text-sm font-semibold mb-1" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
              {translate("DCS_BATCH_COMMENT_LABEL")}
            </p>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              maxLength={1000}
              className="w-full border px-3 py-2 mb-4"
              style={{ borderColor: BORDER, fontFamily: "'Montserrat', sans-serif", fontSize: 14 }}
            />

            <div className="flex gap-3 flex-wrap">
              <DcsButtonPrimary onClick={() => handle_decide("approve")} disabled={acting}>
                {translate("DCS_BATCH_APPROVE")}
              </DcsButtonPrimary>
              <DcsButtonOutlineDanger onClick={() => handle_decide("reject")} disabled={acting}>
                {translate("DCS_BATCH_REJECT")}
              </DcsButtonOutlineDanger>
            </div>
          </>
        )}

        {decision_result && (
          <p
            className="mt-4 text-sm px-3 py-2"
            style={{
              backgroundColor: decision_result.decision === "approved" ? "rgba(76,175,80,0.12)" : "rgba(231,76,60,0.1)",
              color: decision_result.decision === "approved" ? "#4CAF50" : "#E74C3C",
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            {translate(decision_result.decision === "approved" ? "DCS_BATCH_DONE_APPROVED" : "DCS_BATCH_DONE_REJECTED")}
          </p>
        )}

        <div className="mt-6">
          <p className="text-xs font-bold uppercase mb-2" style={{ color: "#555555", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
            {translate("DCS_BATCH_TRAIL")}
          </p>
          <div className="flex flex-col gap-2">
            {(batch.trail || []).map((entry, index) => (
              <div key={index} className="flex items-center justify-between gap-2 border px-3 py-2 flex-wrap" style={{ borderColor: BORDER }}>
                <div>
                  <p className="text-sm" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
                    {entry.name || entry.email}
                  </p>
                  {entry.comment && (
                    <p className="text-xs" style={{ color: "#555555" }}>
                      {entry.comment}
                    </p>
                  )}
                  {entry.acted_at && (
                    <p className="text-xs" style={{ color: "#9E9E9E" }}>
                      {new Date(entry.acted_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <DcsApprovalStatusChip status={entry.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Standalone public route, wrapped with its own language provider like ApprovalPage.
export default function BatchApprovalPage() {
  return (
    <DcsErrorBoundary>
      <DcsLanguageProvider>
        <BatchApprovalPageContent />
      </DcsLanguageProvider>
    </DcsErrorBoundary>
  );
}
