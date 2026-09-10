import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DcsLanguageProvider, useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import {
  get_batch_approval,
  verify_batch_approval_otp,
  get_batch_approval_records,
  resend_batch_approval_otp,
  submit_batch_approval_decision,
} from "../services/approvalsService.js";
import {
  read_session,
  save_session,
  clear_session,
  new_idempotency_key,
  is_session_error,
} from "../services/batchApprovalSession.js";
import DcsBatchTokenDialog from "../components/DcsBatchTokenDialog.jsx";
import DcsApproverPanel from "../components/DcsApproverPanel.jsx";
import DcsDetailsToggleButton from "../components/DcsDetailsToggleButton.jsx";
import DcsApprovalSettingsButton from "../components/DcsApprovalSettingsButton.jsx";
import DcsApprovalFormView from "../components/DcsApprovalFormView.jsx";
import { collect_data_fields, column_label, render_answer_cell, column_width_for } from "../fields/dataColumns.jsx";
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
const CARD_BORDER = "rgba(5,109,170,0.35)";
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
  const { showSuccess, showError, showInfo } = useToast();

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
  const [resending, setResending] = useState(false);
  const [session_notice, setSessionNotice] = useState("");
  const [sending_token, setSendingToken] = useState(false);
  const [panel_open, setPanelOpen] = useState(
    () => typeof window === "undefined" || window.matchMedia("(min-width: 768px)").matches,
  );

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
      .then(async (response) => {
        if (!is_mounted) return;
        setBatch(response.data);
        setLoadState("ready");
        // Records are never fetched on the token alone: only a stored,
        // still-valid signature reopens them without a new code.
        let has_session = false;
        if (read_session(token)) {
          try {
            const records_response = await get_batch_approval_records(token);
            if (is_mounted) setVerified(records_response.data);
            has_session = true;
          } catch (error) {
            clear_session(token);
            if (is_mounted && is_session_error(error)) setSessionNotice(error.message || "");
          }
        }
        if (!has_session && is_mounted && response.data.can_act && !response.data.otp_locked) {
          send_token(true);
        }
      })
      .catch(() => {
        if (is_mounted) setLoadState("not_found");
      });
    return () => {
      is_mounted = false;
    };
  }, [token]);

  const records = (verified && verified.submissions) || [];
  const fields = useMemo(() => (verified && verified.schema ? collect_data_fields(verified.schema.fields) : []), [verified]);

  const handle_verify = async (entered) => {
    const code = (entered || otp).toString().trim();
    if (!code) return;
    setActing(true);
    setSessionNotice("");
    try {
      const response = await verify_batch_approval_otp(token, code);
      save_session(token, response.data.signature, response.data.signature_expires_at);
      setVerified(response.data);
      showSuccess(response.message || "");
    } catch (error) {
      setSessionNotice(error.message || translate("DCS_ERROR_GENERIC"));
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setActing(false);
    }
  };

  // Asks the backend to mail this approver a fresh token. On the first
  // automatic send the page says so; a manual resend just confirms.
  const send_token = async (automatic) => {
    setSendingToken(true);
    if (automatic) showInfo(translate("DCS_BATCH_SENDING_TOKEN"));
    try {
      const response = await resend_batch_approval_otp(token);
      if (response.data && response.data.otp) console.log("Batch approval token:", response.data.otp);
      showSuccess(response.message || "");
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSendingToken(false);
    }
  };

  const handle_resend = async () => {
    setResending(true);
    setSessionNotice("");
    await send_token(false);
    setResending(false);
  };

  const handle_decide = async (decision) => {
    setActing(true);
    try {
      const response = await submit_batch_approval_decision(token, decision, comment.trim() || null, new_idempotency_key());
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
      // A dead signature sends the approver back to the code gate rather
      // than losing their decision to a generic error.
      if (is_session_error(error)) {
        clear_session(token);
        setVerified(null);
        setDecisionModal(null);
        setSessionNotice(error.message || "");
      }
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

  const display_name = approver.name || approver.email_masked;
  const initials =
    (approver.name || approver.email_masked || "?")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "?";

  const label_of = (field) => column_label(field, language, translate);

  const total_pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const current_page = Math.min(page, total_pages);
  const page_records = records.slice((current_page - 1) * PAGE_SIZE, current_page * PAGE_SIZE);
  const form_record = records[Math.min(form_index, Math.max(0, records.length - 1))] || null;
  const form_view_fields = form_record ? fields.filter((field) => form_record.data && Object.prototype.hasOwnProperty.call(form_record.data, field.id)) : [];

  const status_banner = (() => {
    if (batch.otp_locked) return { text: translate("DCS_BATCH_OTP_LOCKED"), background: "rgba(192,86,75,0.08)", color: "#C0564B" };
    if (waiting_for_turn) return { text: translate("DCS_BATCH_NOT_TURN"), background: "rgba(243,156,18,0.1)", color: "#F39C12" };
    if (decision_result)
      return {
        text: translate(decision_result.decision === "approved" ? "DCS_BATCH_DONE_APPROVED" : "DCS_BATCH_DONE_REJECTED"),
        background: decision_result.decision === "approved" ? "rgba(76,175,80,0.12)" : "rgba(192,86,75,0.08)",
        color: decision_result.decision === "approved" ? "#4CAF50" : "#C0564B",
      };
    if (approver.status !== "pending") return { text: translate("DCS_BATCH_ALREADY_ACTED"), background: "#FFFFFF", color: "#555555" };
    return null;
  })();

  return (
    <div className="min-h-screen p-2 sm:p-4 min-[760px]:p-6 lg:h-screen lg:overflow-hidden" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      <div className="flex flex-col lg:flex-row lg:gap-0 max-w-[1400px] mx-auto items-stretch lg:items-start lg:h-full">
        {verified && panel_open && <div className="dcs-details-backdrop" onClick={() => setPanelOpen(false)} />}

        {verified && (
        <div className={`shrink-0 w-full lg:h-full dcs-details-panel ${panel_open ? "is-open" : "is-closed"}`}>
          <DcsApproverPanel
            user={{ email: (verified && verified.email) || approver.email_masked }}
            initials={initials}
            displayName={display_name}
            role={approver.role}
            assignedTo={`${batch.form_name} - ${translate("DCS_SCHED_RECORDS", { count: batch.submission_count })}`}
            message={approver.message}
            onClose={() => setPanelOpen(false)}
            settingsSlot={
              <DcsApprovalSettingsButton
                view={view}
                onViewChange={setView}
                formOptions={[]}
                activeFormKey={null}
                onFormChange={() => {}}
                busy={acting}
              />
            }
            progressNote={translate("DCS_BATCH_VIEWING_NOTE", {
              count: records.length,
              form: batch.form_name,
            })}
          />
        </div>
        )}

        <div className="flex-1 min-w-0 w-full lg:h-full lg:min-h-0 lg:flex lg:flex-col">
          <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
            <span className={`dcs-details-toggle-slot ${verified && !panel_open ? "is-shown" : "is-hidden"}`}>
              <DcsDetailsToggleButton isOpen={false} onClick={() => setPanelOpen(true)} />
            </span>
            <div className="flex items-center gap-2 flex-wrap">
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

          {status_banner && (
            <p
              className="text-sm px-3 py-2 mt-3"
              style={{
                backgroundColor: status_banner.background,
                color: status_banner.color,
                fontFamily: fontHeading,
                border: status_banner.background === "#FFFFFF" ? `1px solid ${BORDER}` : "none",
              }}
            >
              {status_banner.text}
            </p>
          )}

          {verified && view === "table" && (
            <div
              key="table"
              className="dcs-view-swap mt-3 overflow-x-auto overflow-y-auto max-h-[60vh] lg:max-h-none bg-white border-2 min-[760px]:border-[5px] min-[760px]:rounded-[5px] lg:flex-1 lg:min-h-0"
              style={{ borderColor: CARD_BORDER }}
            >
              <table className="w-full text-left" style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
                <thead>
                  <tr style={{ backgroundColor: PRIMARY }}>
                    {fields.map((field) => (
                      <th
                        key={field.id}
                        className="dcs-approvals-head-cell px-4 py-3 text-sm font-bold text-white sticky top-0"
                        style={{ fontFamily: fontHeading, backgroundColor: PRIMARY, ...column_width_for(field) }}
                      >
                        {label_of(field)}
                      </th>
                    ))}
                    <th
                      className="dcs-approvals-head-cell px-4 py-3 text-sm font-bold text-white whitespace-nowrap sticky top-0"
                      style={{ fontFamily: fontHeading, backgroundColor: PRIMARY }}
                    >
                      {translate("DCS_MYAPPROVALS_COL_SUBMITTED")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page_records.map((record, record_index) => (
                    <tr
                      key={record_index}
                      className={`border-t ${record_index % 2 === 0 ? "dcs-approvals-row-odd" : "dcs-approvals-row-even"}`}
                      style={{ borderColor: BORDER }}
                    >
                      {fields.map((field) => (
                        <td
                          key={field.id}
                          className="dcs-approvals-cell px-4 py-3 text-sm align-top"
                          style={{ color: NEUTRAL_DARK, ...column_width_for(field) }}
                        >
                          <div className="dcs-approvals-cell-content">
                            {render_answer_cell(field, record.data ? record.data[field.id] : undefined) || <span style={{ color: GRAY }}>-</span>}
                          </div>
                        </td>
                      ))}
                      <td className="dcs-approvals-cell px-4 py-3 text-sm whitespace-nowrap align-top" style={{ color: "#555555" }}>
                        {record.submitted_at ? new Date(record.submitted_at).toLocaleDateString() : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {verified && view === "table" && total_pages > 1 && (
            <div className="shrink-0 flex items-center justify-center gap-3 mt-3">
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
          )}

          {verified && view === "form" && form_record && (
            <DcsApprovalFormView
              record={form_record}
              form={{ form_name: batch.form_name, schema: verified.schema }}
              index={Math.min(form_index, records.length - 1) + 1}
              total={records.length}
              loadingMore={false}
              canGoPrevious={form_index > 0}
              canGoNext={form_index < records.length - 1}
              onPrevious={() => setFormIndex(Math.max(0, form_index - 1))}
              onNext={() => setFormIndex(Math.min(records.length - 1, form_index + 1))}
              decisionSlot={<DcsApprovalStatusChip status={batch.overall_status} />}
            />
          )}
        </div>
      </div>
      {/* Decision modal - the shared message goes on the batch decision itself */}
      {can_act && !verified && (
        <DcsBatchTokenDialog
          maskedEmail={batch.approver && batch.approver.email_masked}
          busy={acting}
          resending={resending || sending_token}
          notice={session_notice}
          onVerify={handle_verify}
          onResend={handle_resend}
        />
      )}

      {decision_modal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="w-full max-w-lg bg-white">
            <div className="px-5 py-4" style={{ backgroundColor: decision_modal === "approve" ? PRIMARY : "#C0564B" }}>
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
