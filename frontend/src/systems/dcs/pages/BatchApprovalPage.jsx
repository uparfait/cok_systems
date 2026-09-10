import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { DcsLanguageProvider, useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import {
  get_batch_approval,
  verify_batch_approval_otp,
  get_batch_approval_records,
  resend_batch_approval_otp,
  submit_batch_approval_decision,
  submit_batch_record_decision,
} from "../services/approvalsService.js";
import { read_session, save_session, clear_session, is_session_error } from "../services/batchApprovalSession.js";
import { collect_data_fields, column_label, render_answer_cell, column_width_for } from "../fields/dataColumns.jsx";
import DcsFormLoadingSpinner from "../components/DcsFormLoadingSpinner.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";
import DcsErrorBoundary from "../components/DcsErrorBoundary.jsx";
import DcsApprovalStatusChip from "../components/DcsApprovalStatusChip.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsBatchTokenDialog from "../components/DcsBatchTokenDialog.jsx";
import DcsBatchDecisionModal from "../components/DcsBatchDecisionModal.jsx";
import DcsApproverPanel from "../components/DcsApproverPanel.jsx";
import DcsDetailsToggleButton from "../components/DcsDetailsToggleButton.jsx";
import DcsApprovalSettingsButton from "../components/DcsApprovalSettingsButton.jsx";
import DcsApprovalFormView from "../components/DcsApprovalFormView.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const PRIMARY = "#056daa";
const SOFT_RED = "#C0564B";
const GRAY = "#9E9E9E";
const NEUTRAL_DARK = "#333333";
const NEUTRAL_LIGHT = "#F7F9FB";
const BORDER = "#E0E0E0";
const CARD_BORDER = "rgba(5,109,170,0.35)";
const fontHeading = "'Montserrat', sans-serif";
const PAGE_SIZE = 8;

// Approve / reject for one record, replaced by its own decision once settled.
function DecisionButtons({ record, translate, onDecide }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <button
        type="button"
        onClick={() => onDecide({ record, decision: "approve" })}
        className="cursor-pointer text-xs font-bold px-3 py-1.5"
        style={{ backgroundColor: PRIMARY, color: "#FFFFFF", fontFamily: fontHeading, borderRadius: 4 }}
      >
        {translate("DCS_APPROVAL_BTN_APPROVE")}
      </button>
      <button
        type="button"
        onClick={() => onDecide({ record, decision: "reject" })}
        className="cursor-pointer text-xs font-bold px-3 py-1.5"
        style={{ backgroundColor: "transparent", color: SOFT_RED, border: `1px solid ${SOFT_RED}`, fontFamily: fontHeading, borderRadius: 4 }}
      >
        {translate("DCS_APPROVAL_BTN_REJECT")}
      </button>
    </div>
  );
}

function RecordState({ record, canAct, translate, onDecide }) {
  if (record && record.my_decision) return <DcsApprovalStatusChip status={record.my_decision} />;
  if (!canAct) return <span style={{ color: GRAY }}>-</span>;
  return <DecisionButtons record={record} translate={translate} onDecide={onDecide} />;
}

function BatchApprovalPageContent() {
  const { token } = useParams();
  const { translate, language } = useDcsLanguage();
  const { showSuccess, showError, showInfo } = useToast();

  const [load_state, setLoadState] = useState("loading");
  const [batch, setBatch] = useState(null);
  const [verified, setVerified] = useState(null);
  const [schema, setSchema] = useState(null);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [has_more, setHasMore] = useState(false);
  const [loading_more, setLoadingMore] = useState(false);
  const [batch_error, setBatchError] = useState(false);
  const [view, setView] = useState("table");
  const [form_index, setFormIndex] = useState(0);
  const [viewed, setViewed] = useState(() => new Set());
  const [panel_open, setPanelOpen] = useState(
    () => typeof window === "undefined" || window.matchMedia("(min-width: 768px)").matches,
  );
  const [decision_target, setDecisionTarget] = useState(null);
  const [bulk_target, setBulkTarget] = useState(null);
  const [acting, setActing] = useState(false);
  const [decision_result, setDecisionResult] = useState(null);
  const [resending, setResending] = useState(false);
  const [sending_token, setSendingToken] = useState(false);
  const [token_failed, setTokenFailed] = useState(false);
  const [session_notice, setSessionNotice] = useState("");

  // Scroll events fire faster than state settles, so overlapping fetches are guarded.
  const fetching_ref = useRef(false);
  const table_scroll_ref = useRef(null);

  const apply_batch = (data, mode) => {
    if (data.schema) setSchema(data.schema);
    setTotal(data.total || 0);
    setHasMore(Boolean(data.has_more));
    setRecords((previous) => (mode === "append" ? [...previous, ...(data.records || [])] : data.records || []));
  };

  const send_token = async (automatic) => {
    setSendingToken(true);
    setTokenFailed(false);
    if (automatic) showInfo(translate("DCS_BATCH_SENDING_TOKEN"));
    try {
      const response = await resend_batch_approval_otp(token);
      if (response.data && response.data.otp) console.log("Batch approval token:", response.data.otp);
      showSuccess(response.message || "");
    } catch (error) {
      setTokenFailed(true);
      setSessionNotice(error.message || translate("DCS_ERROR_GENERIC"));
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSendingToken(false);
    }
  };

  const lose_session = (message) => {
    clear_session(token);
    setVerified(null);
    setRecords([]);
    setTotal(0);
    setHasMore(false);
    setSessionNotice(message || "");
  };

  // First page of records, once a session signature exists.
  const load = () => {
    if (fetching_ref.current) return;
    fetching_ref.current = true;
    setLoadingMore(true);
    setFormIndex(0);
    get_batch_approval_records(token, 0, PAGE_SIZE)
      .then((response) => {
        apply_batch(response.data, "replace");
        setBatchError(false);
        setVerified({ ready: true, email: response.data.email });
      })
      .catch((error) => {
        if (is_session_error(error)) {
          lose_session(error.message || "");
          return;
        }
        showError(error.message || translate("DCS_ERROR_GENERIC"));
        setBatchError(true);
      })
      .finally(() => {
        fetching_ref.current = false;
        setLoadingMore(false);
      });
  };

  // Next scroll batch, appended below the rows already on screen.
  const load_more = (after_load) => {
    if (fetching_ref.current || !has_more || !verified) return;
    fetching_ref.current = true;
    setLoadingMore(true);
    get_batch_approval_records(token, records.length, PAGE_SIZE)
      .then((response) => {
        apply_batch(response.data, "append");
        setBatchError(false);
        if (after_load) after_load(records.length + (response.data.records || []).length);
      })
      .catch((error) => {
        if (is_session_error(error)) {
          lose_session(error.message || "");
          return;
        }
        showError(error.message || translate("DCS_ERROR_GENERIC"));
        setBatchError(true);
      })
      .finally(() => {
        fetching_ref.current = false;
        setLoadingMore(false);
      });
  };

  // After a decision: re-read exactly the rows already loaded, so states
  // update without losing the scroll position.
  const refresh = () => {
    if (fetching_ref.current) return;
    fetching_ref.current = true;
    setLoadingMore(true);
    get_batch_approval_records(token, 0, Math.max(PAGE_SIZE, records.length))
      .then((response) => apply_batch(response.data, "replace"))
      .catch((error) => {
        if (is_session_error(error)) lose_session(error.message || "");
        else showError(error.message || translate("DCS_ERROR_GENERIC"));
      })
      .finally(() => {
        fetching_ref.current = false;
        setLoadingMore(false);
      });
  };

  useEffect(() => {
    let is_mounted = true;
    setLoadState("loading");
    get_batch_approval(token)
      .then((response) => {
        if (!is_mounted) return;
        setBatch(response.data);
        setLoadState("ready");
        // Records never travel on the token alone: a stored signature
        // reopens them, otherwise a fresh token is requested right away.
        if (read_session(token)) load();
        else if (response.data.can_act && !response.data.otp_locked) send_token(true);
      })
      .catch(() => {
        if (is_mounted) setLoadState("not_found");
      });
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handle_verify = async (entered) => {
    const code = (entered || "").toString().trim();
    if (!code) return;
    setActing(true);
    setSessionNotice("");
    try {
      const response = await verify_batch_approval_otp(token, code);
      save_session(token, response.data.signature, response.data.signature_expires_at);
      setSchema(response.data.schema || null);
      setVerified({ ready: true, email: response.data.email });
      showSuccess(response.message || "");
      load();
    } catch (error) {
      setSessionNotice(error.message || translate("DCS_ERROR_GENERIC"));
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setActing(false);
    }
  };

  const handle_resend = async () => {
    setResending(true);
    setSessionNotice("");
    await send_token(false);
    setResending(false);
  };

  const handle_table_scroll = (event) => {
    const element = event.currentTarget;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 80) load_more();
  };

  // On tall screens one batch may not overflow the container, leaving
  // nothing to scroll - keep fetching until it does.
  useEffect(() => {
    const element = table_scroll_ref.current;
    if (!element || view !== "table" || !has_more || loading_more) return;
    if (element.scrollHeight <= element.clientHeight + 4) load_more();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, has_more, loading_more, view]);

  // A record counts as viewed once it has actually been displayed: the
  // table renders every loaded row, the form view one record at a time.
  useEffect(() => {
    if (records.length === 0) return;
    const shown = view === "table" ? records : [records[Math.min(form_index, records.length - 1)]];
    const ids = shown.map((record) => record && record.id).filter(Boolean);
    if (ids.length === 0) return;
    setViewed((previous) => {
      if (ids.every((id) => previous.has(id))) return previous;
      const next = new Set(previous);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, [view, form_index, records]);

  const fields = useMemo(() => (schema ? collect_data_fields(schema.fields) : []), [schema]);

  if (load_state === "loading") return <DcsFormLoadingSpinner />;
  if (load_state === "not_found") return <DcsEmptyState messageKey="DCS_APPROVAL_NOT_FOUND" />;

  const label_of = (field) => column_label(field, language, translate);

  const approver = batch.approver;
  const can_act = batch.can_act && !batch.otp_locked && !decision_result && approver.status === "pending";
  const waiting_for_turn = approver.status === "pending" && !batch.can_act && !batch.otp_locked && !decision_result;
  const display_name = approver.name || (verified && verified.email) || approver.email_masked;
  const initials =
    (approver.name || approver.email_masked || "?")
      .trim()
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "?";

  const form_record = records[Math.min(form_index, Math.max(0, records.length - 1))] || null;
  const approvable = records.filter((record) => !record.my_decision && viewed.has(record.id));

  const status_banner = (() => {
    if (batch.otp_locked) return { text: translate("DCS_BATCH_OTP_LOCKED"), background: "rgba(192,86,75,0.08)", color: SOFT_RED };
    if (waiting_for_turn) return { text: translate("DCS_BATCH_NOT_TURN"), background: "rgba(243,156,18,0.1)", color: "#F39C12" };
    if (decision_result)
      return {
        text: translate(decision_result.decision === "approved" ? "DCS_BATCH_DONE_APPROVED" : "DCS_BATCH_DONE_REJECTED"),
        background: decision_result.decision === "approved" ? "rgba(76,175,80,0.12)" : "rgba(192,86,75,0.08)",
        color: decision_result.decision === "approved" ? "#4CAF50" : SOFT_RED,
      };
    if (approver.status !== "pending") return { text: translate("DCS_BATCH_ALREADY_ACTED"), background: "#FFFFFF", color: "#555555" };
    return null;
  })();

  // A per-record decision may be the one that closes this approver's step.
  const on_step_closed = (data) => {
    if (data && data.step_status && data.step_status !== "pending") {
      setDecisionResult({ decision: data.step_status, overall_status: data.overall_status });
      setBatch((previous) =>
        Object.assign({}, previous, {
          overall_status: data.overall_status,
          approver: Object.assign({}, previous.approver, { status: data.step_status }),
        }),
      );
    }
  };

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
              assignedTo={batch.form_name}
              message={approver.message}
              onClose={() => setPanelOpen(false)}
              settingsSlot={
                <DcsApprovalSettingsButton
                  view={view}
                  onViewChange={setView}
                  formOptions={[]}
                  activeFormKey={null}
                  onFormChange={() => {}}
                  busy={loading_more}
                />
              }
              progressNote={translate("DCS_BATCH_VIEWED_HINT", {
                viewed: records.filter((record) => viewed.has(record.id)).length,
                total,
                decided: records.filter((record) => record.my_decision).length,
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
                <DcsButtonPrimary onClick={() => setBulkTarget("approve")} disabled={acting || approvable.length === 0}>
                  {translate("DCS_MYAPPROVALS_APPROVE_ALL", { count: approvable.length })}
                </DcsButtonPrimary>
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

          {verified && total === 0 && !loading_more && (
            <div className="mt-6">
              <DcsEmptyState messageKey="DCS_MYAPPROVALS_EMPTY" />
            </div>
          )}

          {verified && (total > 0 || loading_more) && view === "table" && (
            <div
              key="table"
              ref={table_scroll_ref}
              onScroll={handle_table_scroll}
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
                    <th
                      className="dcs-approvals-head-cell px-4 py-3 text-sm font-bold text-white whitespace-nowrap sticky top-0"
                      style={{ fontFamily: fontHeading, backgroundColor: PRIMARY }}
                    >
                      {translate("DCS_MYAPPROVALS_COL_STATUS")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, row_index) => (
                    <tr
                      key={record.id}
                      className={`border-t ${row_index % 2 === 0 ? "dcs-approvals-row-odd" : "dcs-approvals-row-even"}`}
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
                      <td className="dcs-approvals-cell px-4 py-3 align-top">
                        <RecordState record={record} canAct={can_act} translate={translate} onDecide={setDecisionTarget} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {loading_more && (
                <div className="flex items-center justify-center gap-3 py-4 border-t" style={{ borderColor: BORDER }}>
                  <SpiralLoader padded={false} size={20} />
                  <span className="text-sm" style={{ color: GRAY, fontFamily: fontHeading }}>{translate("DCS_MYAPPROVALS_LOADING_MORE")}</span>
                </div>
              )}
              {!loading_more && batch_error && (
                <div className="flex items-center justify-center gap-2 py-4 border-t" style={{ borderColor: BORDER }}>
                  <span className="text-sm" style={{ color: GRAY, fontFamily: fontHeading }}>{translate("DCS_MYAPPROVALS_LOAD_FAILED")}</span>
                  <button type="button" onClick={() => load()} className="dcs-retry-link text-sm" style={{ fontFamily: fontHeading }}>
                    {translate("DCS_MYAPPROVALS_RETRY")}
                  </button>
                </div>
              )}
              {!loading_more && !batch_error && !has_more && records.length > 0 && (
                <p className="text-center text-xs py-3 border-t" style={{ color: GRAY, fontFamily: fontHeading, borderColor: BORDER }}>
                  {translate("DCS_MYAPPROVALS_ALL_LOADED", { total })}
                </p>
              )}
            </div>
          )}

          {verified && records.length > 0 && view === "form" && form_record && (
            <DcsApprovalFormView
              record={form_record}
              form={{ form_name: batch.form_name, schema }}
              index={Math.min(form_index, records.length - 1) + 1}
              total={total}
              loadingMore={loading_more}
              canGoPrevious={form_index > 0 && !loading_more}
              canGoNext={!loading_more && (form_index < records.length - 1 || has_more)}
              onPrevious={() => setFormIndex(Math.max(0, form_index - 1))}
              onNext={() => {
                if (form_index < records.length - 1) setFormIndex(form_index + 1);
                else load_more((loaded) => setFormIndex(Math.min(loaded - 1, form_index + 1)));
              }}
              decisionSlot={<RecordState record={form_record} canAct={can_act} translate={translate} onDecide={setDecisionTarget} />}
            />
          )}
        </div>
      </div>

      {can_act && !verified && (
        <DcsBatchTokenDialog
          maskedEmail={batch.approver && batch.approver.email_masked}
          busy={acting}
          resending={resending || sending_token}
          sendFailed={token_failed}
          notice={session_notice}
          onVerify={handle_verify}
          onResend={handle_resend}
        />
      )}

      {decision_target && (
        <DcsBatchDecisionModal
          token={token}
          formName={batch.form_name}
          recordCount={1}
          decision={decision_target.decision}
          onClose={() => setDecisionTarget(null)}
          onSubmit={(comment, key, signature) =>
            submit_batch_record_decision(token, decision_target.record.id, decision_target.decision, comment, key, signature)
          }
          onDone={(data) => {
            setDecisionTarget(null);
            on_step_closed(data);
            refresh();
          }}
          onSessionLost={(message) => {
            setDecisionTarget(null);
            lose_session(message);
          }}
        />
      )}

      {bulk_target && (
        <DcsBatchDecisionModal
          token={token}
          formName={batch.form_name}
          recordCount={approvable.length}
          decision={bulk_target}
          onClose={() => setBulkTarget(null)}
          onSubmit={(comment, key, signature) => submit_batch_approval_decision(token, bulk_target, comment, key, signature)}
          onDone={(data) => {
            setBulkTarget(null);
            setDecisionResult({ decision: data.decision, overall_status: data.overall_status });
            setBatch((previous) =>
              Object.assign({}, previous, {
                overall_status: data.overall_status,
                approver: Object.assign({}, previous.approver, { status: data.decision }),
              }),
            );
            refresh();
          }}
          onSessionLost={(message) => {
            setBulkTarget(null);
            lose_session(message);
          }}
        />
      )}
    </div>
  );
}

// Public route /dcs-batch-approval/:token, with its own DCS language provider.
export default function BatchApprovalPage() {
  return (
    <DcsErrorBoundary>
      <DcsLanguageProvider>
        <BatchApprovalPageContent />
      </DcsLanguageProvider>
    </DcsErrorBoundary>
  );
}
