import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsButtonOutlineDanger from "../components/DcsButtonOutlineDanger.jsx";

const PRIMARY = "#056daa";
const GRAY = "#9E9E9E";
const NEUTRAL_DARK = "#333333";
const NEUTRAL_LIGHT = "#F7F9FB";
const BORDER = "#E0E0E0";
const fontHeading = "'Montserrat', sans-serif";
const PAGE_SIZE = 10;
const NON_DATA_TYPES = ["section", "paragraph", "header", "file", "group", "image_block", "horizontal_line"];

// One submitted answer displayed read-only; media answers render as links, never re-fetched blobs.
function AnswerValue({ value }) {
  if (value === null || value === undefined || value === "") return <span style={{ color: GRAY }}>-</span>;
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

/** Small labeled box used down the sidebar. */
function SidebarBox({ label, children }) {
  return (
    <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
      <p className="text-xs font-bold uppercase" style={{ color: GRAY, fontFamily: fontHeading, letterSpacing: 0.5 }}>{label}</p>
      <div className="text-sm mt-1 font-semibold break-words" style={{ color: NEUTRAL_DARK }}>{children}</div>
    </div>
  );
}

/**
 * Public batch approver page behind /dcs-batch-approval/:token, laid out
 * like the registered approver's dashboard: identity sidebar on the left
 * (name, email, assigned form and the author's message), and on the right
 * the collected records in a table or record-by-record form view, with a
 * switcher to this approver's other forms still waiting on them. The link
 * token identifies the approver; the records only appear after the
 * one-time code from their email is verified, and the same code
 * authorizes the final approve/reject decision.
 */
function BatchApprovalPageContent() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { translate, language } = useDcsLanguage();
  const { showSuccess, showError } = useToast();

  const [batch, setBatch] = useState(null);
  const [load_state, setLoadState] = useState("loading");
  const [otp, setOtp] = useState("");
  const [verified, setVerified] = useState(null);
  const [view, setView] = useState("table");
  const [page, setPage] = useState(1);
  const [form_index, setFormIndex] = useState(0);
  const [comment, setComment] = useState("");
  const [acting, setActing] = useState(false);
  const [decision_result, setDecisionResult] = useState(null);
  const [decision_modal, setDecisionModal] = useState(null);

  useEffect(() => {
    let is_mounted = true;
    // A fresh token (switching to another form) starts over: new code, new records.
    setLoadState("loading");
    setBatch(null);
    setOtp("");
    setVerified(null);
    setView("table");
    setPage(1);
    setFormIndex(0);
    setComment("");
    setDecisionResult(null);
    setDecisionModal(null);
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

  const records = (verified && verified.submissions) || [];
  const fields = useMemo(
    () => (verified && verified.schema ? flatten_fields(verified.schema.fields || []).filter((field) => !NON_DATA_TYPES.includes(field.type)) : []),
    [verified],
  );

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
      setDecisionModal(null);
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

  const approver = batch.approver;
  // The hierarchy is enforced server-side too - can_act is false until every approver before this one has approved.
  const can_act = batch.can_act && !batch.otp_locked && !decision_result;
  const waiting_for_turn = approver.status === "pending" && !batch.can_act && !batch.otp_locked && !decision_result;

  const display_name = approver.name || approver.email;
  const initials =
    (approver.name || approver.email)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "?";

  const label_of = (field) => get_field_text(field.label, language) || field.id;

  const total_pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const current_page = Math.min(page, total_pages);
  const page_records = records.slice((current_page - 1) * PAGE_SIZE, current_page * PAGE_SIZE);
  const form_record = records[Math.min(form_index, Math.max(0, records.length - 1))] || null;
  const form_view_fields = form_record ? fields.filter((field) => form_record.data && Object.prototype.hasOwnProperty.call(form_record.data, field.id)) : [];

  return (
    <div className="min-h-screen p-3 sm:p-6" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      <div className="flex flex-col lg:flex-row gap-4 max-w-[1400px] mx-auto items-start">
        {/* Sidebar - approver identity, assignment and the author's message */}
        <div className="w-full lg:w-[320px] shrink-0 bg-white border p-4 space-y-3" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-3 pb-3 border-b" style={{ borderColor: BORDER }}>
            <div className="w-14 h-14 flex items-center justify-center text-white text-xl font-extrabold shrink-0" style={{ backgroundColor: PRIMARY, fontFamily: fontHeading }}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-extrabold truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{display_name}</p>
              {approver.role && <p className="text-sm font-semibold" style={{ color: PRIMARY, fontFamily: fontHeading }}>{approver.role}</p>}
            </div>
          </div>

          <SidebarBox label={translate("DCS_MYAPPROVALS_EMAIL")}>{approver.email}</SidebarBox>
          <SidebarBox label={translate("DCS_MYAPPROVALS_ASSIGNED_TO")}>
            {batch.form_name}
            <span className="block text-xs mt-0.5 font-normal" style={{ color: GRAY }}>
              {translate("DCS_SCHED_RECORDS", { count: batch.submission_count })}
              {batch.sent_at ? ` - ${new Date(batch.sent_at).toLocaleString()}` : ""}
            </span>
          </SidebarBox>
          <SidebarBox label={translate("DCS_MYAPPROVALS_COL_STATUS")}>
            <DcsApprovalStatusChip status={batch.overall_status} />
          </SidebarBox>
          <SidebarBox label={translate("DCS_APPROVAL_MESSAGE_FOR_YOU")}>
            <span className="font-normal">{approver.message || translate("DCS_MYAPPROVALS_DEFAULT_MESSAGE")}</span>
          </SidebarBox>
        </div>

        {/* Records panel */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="inline-flex border" style={{ borderColor: BORDER, backgroundColor: "#FFFFFF" }}>
              {["table", "form"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  className="cursor-pointer text-sm font-bold px-4 py-2.5"
                  style={{
                    fontFamily: fontHeading,
                    backgroundColor: view === mode ? PRIMARY : "transparent",
                    color: view === mode ? "#FFFFFF" : GRAY,
                  }}
                >
                  {translate(mode === "table" ? "DCS_MYAPPROVALS_TABLE_VIEW" : "DCS_MYAPPROVALS_FORM_VIEW")}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(batch.other_batches || []).length > 0 && (
                <select
                  value={token}
                  onChange={(event) => navigate(`/dcs-batch-approval/${event.target.value}`)}
                  className="cok-auth-input pr-3 py-2 text-sm"
                  style={{ backgroundColor: "#FFFFFF" }}
                >
                  <option value={token}>{batch.form_name}</option>
                  {batch.other_batches.map((entry) => (
                    <option key={entry.token} value={entry.token}>
                      {entry.form_name} ({entry.submission_count})
                    </option>
                  ))}
                </select>
              )}
              {can_act && verified && (
                <>
                  <DcsButtonOutlineDanger onClick={() => setDecisionModal("reject")} disabled={acting}>
                    {translate("DCS_BATCH_REJECT")}
                  </DcsButtonOutlineDanger>
                  <DcsButtonPrimary onClick={() => setDecisionModal("approve")} disabled={acting}>
                    {translate("DCS_BATCH_APPROVE")}
                  </DcsButtonPrimary>
                </>
              )}
            </div>
          </div>

          {/* State banners */}
          {batch.otp_locked && (
            <p className="text-sm px-3 py-2 mt-3" style={{ backgroundColor: "rgba(231,76,60,0.1)", color: "#E74C3C", fontFamily: fontHeading }}>
              {translate("DCS_BATCH_OTP_LOCKED")}
            </p>
          )}
          {waiting_for_turn && (
            <p className="text-sm px-3 py-2 mt-3" style={{ backgroundColor: "rgba(243,156,18,0.1)", color: "#F39C12", fontFamily: fontHeading }}>
              {translate("DCS_BATCH_NOT_TURN")}
            </p>
          )}
          {approver.status !== "pending" && !decision_result && (
            <p className="text-sm px-3 py-2 mt-3" style={{ backgroundColor: "#FFFFFF", color: "#555555", border: `1px solid ${BORDER}`, fontFamily: fontHeading }}>
              {translate("DCS_BATCH_ALREADY_ACTED")}
            </p>
          )}
          {decision_result && (
            <p
              className="text-sm px-3 py-2 mt-3"
              style={{
                backgroundColor: decision_result.decision === "approved" ? "rgba(76,175,80,0.12)" : "rgba(231,76,60,0.1)",
                color: decision_result.decision === "approved" ? "#4CAF50" : "#E74C3C",
                fontFamily: fontHeading,
              }}
            >
              {translate(decision_result.decision === "approved" ? "DCS_BATCH_DONE_APPROVED" : "DCS_BATCH_DONE_REJECTED")}
            </p>
          )}

          {/* One-time code gate - the records only show after the emailed code is verified */}
          {can_act && !verified && (
            <div className="mt-3 bg-white border p-4 sm:p-6" style={{ borderColor: BORDER }}>
              <p className="text-sm font-semibold mb-3" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                {translate("DCS_BATCH_OTP_LABEL")}
              </p>
              <div className="flex gap-2 flex-wrap items-center">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="border px-3"
                  style={{ borderColor: BORDER, height: 44, width: 160, fontFamily: fontHeading, fontSize: 20, letterSpacing: 6, textAlign: "center" }}
                />
                <DcsButtonPrimary onClick={handle_verify} disabled={acting || otp.length < 6}>
                  {translate("DCS_BATCH_OTP_VERIFY")}
                </DcsButtonPrimary>
              </div>
            </div>
          )}

          {/* Table view */}
          {verified && view === "table" && (
            <>
              <div className="mt-3 overflow-x-auto bg-white border" style={{ borderColor: BORDER }}>
                <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: PRIMARY }}>
                      {fields.map((field) => (
                        <th key={field.id} className="px-4 py-3 text-sm font-bold text-white whitespace-nowrap" style={{ fontFamily: fontHeading }}>
                          {label_of(field)}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-sm font-bold text-white whitespace-nowrap" style={{ fontFamily: fontHeading }}>
                        {translate("DCS_MYAPPROVALS_COL_SUBMITTED")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {page_records.map((record, record_index) => (
                      <tr key={record_index} className="border-t" style={{ borderColor: BORDER }}>
                        {fields.map((field) => (
                          <td key={field.id} className="px-4 py-3 text-sm" style={{ color: NEUTRAL_DARK }}>
                            <AnswerValue value={record.data ? record.data[field.id] : undefined} />
                          </td>
                        ))}
                        <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: "#555555" }}>
                          {record.submitted_at ? new Date(record.submitted_at).toLocaleDateString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <DcsButtonOutline onClick={() => setPage(Math.max(1, current_page - 1))} disabled={current_page <= 1}>
                  {translate("DCS_MYAPPROVALS_PREVIOUS")}
                </DcsButtonOutline>
                <span className="text-sm font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                  {translate("DCS_MYAPPROVALS_PAGE_OF", { page: current_page, pages: total_pages })}
                </span>
                <DcsButtonOutline onClick={() => setPage(Math.min(total_pages, current_page + 1))} disabled={current_page >= total_pages}>
                  {translate("DCS_MYAPPROVALS_NEXT")}
                </DcsButtonOutline>
              </div>
            </>
          )}

          {/* Form view - one record at a time */}
          {verified && view === "form" && form_record && (
            <div className="mt-3 bg-white border p-4 sm:p-6" style={{ borderColor: BORDER }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-base font-extrabold" style={{ color: PRIMARY, fontFamily: fontHeading }}>{batch.form_name}</p>
                <p className="text-xs" style={{ color: GRAY, fontFamily: fontHeading }}>
                  {form_record.submitted_at ? new Date(form_record.submitted_at).toLocaleString() : ""}
                </p>
              </div>

              <div className="border mt-4" style={{ borderColor: BORDER }}>
                {form_view_fields.length === 0 && <p className="p-3 text-sm" style={{ color: GRAY }}>-</p>}
                {form_view_fields.map((field, index) => (
                  <div key={field.id} className="p-3 flex flex-col gap-1" style={{ borderTop: index === 0 ? "none" : `1px solid ${BORDER}` }}>
                    <span className="text-xs font-semibold uppercase" style={{ color: GRAY, fontFamily: fontHeading, letterSpacing: 0.5 }}>{label_of(field)}</span>
                    <span className="text-sm" style={{ color: NEUTRAL_DARK }}>
                      <AnswerValue value={form_record.data ? form_record.data[field.id] : undefined} />
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 mt-4">
                <DcsButtonOutline onClick={() => setFormIndex(Math.max(0, form_index - 1))} disabled={form_index <= 0}>
                  {translate("DCS_MYAPPROVALS_PREVIOUS")}
                </DcsButtonOutline>
                <span className="text-sm font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                  {translate("DCS_MYAPPROVALS_RECORD_OF", { index: Math.min(form_index, records.length - 1) + 1, total: records.length })}
                </span>
                <DcsButtonOutline onClick={() => setFormIndex(Math.min(records.length - 1, form_index + 1))} disabled={form_index >= records.length - 1}>
                  {translate("DCS_MYAPPROVALS_NEXT")}
                </DcsButtonOutline>
              </div>
            </div>
          )}

          {/* Approval trail */}
          <div className="mt-4 bg-white border p-4" style={{ borderColor: BORDER }}>
            <p className="text-xs font-bold uppercase mb-2" style={{ color: GRAY, fontFamily: fontHeading, letterSpacing: 0.5 }}>
              {translate("DCS_BATCH_TRAIL")}
            </p>
            <div className="flex flex-col gap-2">
              {(batch.trail || []).map((entry, index) => (
                <div key={index} className="flex items-center justify-between gap-2 border px-3 py-2 flex-wrap" style={{ borderColor: BORDER }}>
                  <div>
                    <p className="text-sm" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                      {entry.name || entry.email}
                      {entry.role ? <span style={{ color: "#555555" }}> - {entry.role}</span> : null}
                    </p>
                    {entry.comment && <p className="text-xs" style={{ color: "#555555" }}>{entry.comment}</p>}
                    {entry.acted_at && <p className="text-xs" style={{ color: GRAY }}>{new Date(entry.acted_at).toLocaleString()}</p>}
                  </div>
                  <DcsApprovalStatusChip status={entry.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Decision modal - the shared message goes on the batch decision itself */}
      {decision_modal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="w-full max-w-lg bg-white">
            <div className="px-5 py-4" style={{ backgroundColor: decision_modal === "approve" ? PRIMARY : "#E74C3C" }}>
              <h2 className="text-white font-bold text-base" style={{ fontFamily: fontHeading }}>
                {translate(decision_modal === "approve" ? "DCS_BATCH_APPROVE" : "DCS_BATCH_REJECT")} - {batch.form_name}
              </h2>
            </div>
            <div className="p-5">
              <p className="text-sm" style={{ color: "#555555", fontFamily: fontHeading }}>
                {translate("DCS_BATCH_RECORDS_WAITING", { count: batch.submission_count })}
              </p>

              <label className="block text-xs font-semibold uppercase mt-4 mb-1" style={{ color: GRAY, fontFamily: fontHeading, letterSpacing: 0.5 }}>
                {translate("DCS_BATCH_COMMENT_LABEL")}
              </label>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full text-sm p-2 border"
                style={{ borderColor: BORDER, fontFamily: fontHeading, outline: "none", resize: "vertical" }}
              />

              <div className="flex gap-3 mt-5 flex-wrap">
                <DcsButtonOutline onClick={() => setDecisionModal(null)} disabled={acting} className="flex-1">
                  {translate("DCS_MYAPPROVALS_CANCEL")}
                </DcsButtonOutline>
                {decision_modal === "approve" ? (
                  <DcsButtonPrimary onClick={() => handle_decide("approve")} disabled={acting} className="flex-1">
                    {translate("DCS_BATCH_APPROVE")}
                  </DcsButtonPrimary>
                ) : (
                  <DcsButtonOutlineDanger onClick={() => handle_decide("reject")} disabled={acting} className="flex-1">
                    {translate("DCS_BATCH_REJECT")}
                  </DcsButtonOutlineDanger>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
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
