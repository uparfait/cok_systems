import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import {
  get_approval_schedule,
  save_approval_schedule,
  save_approval_settings,
  get_approver_link,
  cancel_approval_schedule,
  send_approval_links_now,
} from "../services/approvalsService.js";
import DcsApprovalStatusChip from "./DcsApprovalStatusChip.jsx";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";
import { TwoColumnSkeleton } from "./DcsSkeletons.jsx";

const BORDER = "#E0E0E0";
const PRIMARY = "#056daa";
const TEXT = "#333333";
const MUTED = "#555555";
const FADED = "#9E9E9E";
const FONT = "'Montserrat', sans-serif";

const INPUT_STYLE = {
  border: `1px solid ${BORDER}`,
  padding: "8px 10px",
  fontFamily: FONT,
  fontSize: 14,
  color: TEXT,
  width: "100%",
  backgroundColor: "#FFFFFF",
};

/** Small uppercase section heading used across the dialog. */
function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-bold uppercase mb-2" style={{ color: FADED, fontFamily: FONT, letterSpacing: "1px" }}>
      {children}
    </p>
  );
}

const MODE_ICONS = {
  now: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  count: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  ),
  datetime: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
};

/** One choice of when the links go out: right now, after N responses, or at a date and time. */
function SendModeOption({ value, mode, onSelect, labelKey, hintKey, children }) {
  const { translate } = useDcsLanguage();
  const is_selected = mode === value;
  return (
    <label
      className="block border-2 px-4 py-3 cursor-pointer transition-colors"
      style={{ borderColor: is_selected ? PRIMARY : BORDER, backgroundColor: is_selected ? "rgba(5,109,170,0.04)" : "#FFFFFF" }}
    >
      <input type="radio" name="dcs_send_mode" checked={is_selected} onChange={() => onSelect(value)} className="sr-only" />
      <span className="flex items-start gap-3">
        <span
          className="flex-shrink-0 flex items-center justify-center mt-0.5"
          style={{ width: 34, height: 34, color: is_selected ? "#FFFFFF" : PRIMARY, backgroundColor: is_selected ? PRIMARY : "rgba(5,109,170,0.08)" }}
        >
          {MODE_ICONS[value]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold" style={{ color: TEXT, fontFamily: FONT }}>
              {translate(labelKey)}
            </span>
            <span
              className="flex-shrink-0 flex items-center justify-center"
              style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${is_selected ? PRIMARY : BORDER}` }}
            >
              {is_selected && <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: PRIMARY }} />}
            </span>
          </span>
          <span className="block text-xs mt-0.5 leading-relaxed" style={{ color: FADED, fontFamily: FONT }}>
            {translate(hintKey)}
          </span>
          {is_selected && children && <span className="block mt-2.5">{children}</span>}
        </span>
      </span>
    </label>
  );
}

/** The form's approver chain, numbered and connected top to bottom - purely informative here. */
function ApproverChain({ approvers, formGroupId, onCopied, onFailed }) {
  const { translate } = useDcsLanguage();
  const [copying, setCopying] = useState("");

  const copy_link = async (email) => {
    setCopying(email);
    try {
      const response = await get_approver_link(formGroupId, email);
      const link = response.data && response.data.link;
      if (!link) throw new Error(response.message || "");
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(link);
      onCopied(link);
    } catch (error) {
      onFailed(error.message || "");
    } finally {
      setCopying("");
    }
  };

  return (
    <div className="flex flex-col">
      {approvers.map((approver, index) => (
        <div key={`${approver.email}-${index}`} className="flex gap-3">
          <div className="flex flex-col items-center flex-shrink-0">
            <span
              className="flex items-center justify-center text-xs font-bold"
              style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: PRIMARY, color: "#FFFFFF", fontFamily: FONT }}
            >
              {index + 1}
            </span>
            {index < approvers.length - 1 && <span className="flex-1" style={{ width: 2, minHeight: 14, backgroundColor: "rgba(5,109,170,0.25)" }} />}
          </div>
          <div className="min-w-0 pb-3 flex-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate leading-7" style={{ color: TEXT, fontFamily: FONT }}>
                {approver.name || approver.email}
                {approver.role ? <span style={{ color: MUTED, fontWeight: 400 }}> - {approver.role}</span> : null}
              </p>
              <button
                type="button"
                onClick={() => copy_link(approver.email)}
                disabled={copying === approver.email}
                className="text-xs font-bold uppercase cursor-pointer px-2 py-1 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ fontFamily: FONT, letterSpacing: 0.5, color: PRIMARY, border: "1px solid " + PRIMARY, background: "none" }}
              >
                {translate("DCS_SCHED_COPY_LINK")}
              </button>
            </div>
            <p className="text-xs truncate" style={{ color: FADED, fontFamily: FONT }}>
              {approver.email}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The data page's "Schedule approval" dialog - purely a timer. The
 * approvers themselves come from the form's own approval flow settings
 * (shown read-only here, in their hierarchy order); this dialog only
 * decides WHEN the first of them gets their link and one-time code:
 * right now, after N collected responses, or at a chosen date and time.
 * The chain then advances approver by approver as each one approves.
 * Lays out as two columns (approvers | timing) on wide screens and
 * stacks vertically on narrow ones.
 */
/**
 * When a form's collected records go out to its approvers: right now,
 * after so many responses, or at a chosen date and time. Used as the
 * dialog it has always been, and - with asPage - as the body of the
 * Schedule approvals page reached from the form's workspace panel,
 * where this is the page's own work rather than something laid over it.
 */
export default function DcsApprovalScheduleDialog({ form_group_id, onClose, onChanged, asPage }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();

  const [load_state, setLoadState] = useState("loading");
  const [approvers, setApprovers] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [requests, setRequests] = useState([]);
  const [mode, setMode] = useState("now");
  const [count, setCount] = useState(10);
  const [datetime, setDatetime] = useState("");
  const [acting, setActing] = useState(false);
  const [retention, setRetention] = useState("month");
  const [retention_configured, setRetentionConfigured] = useState(true);
  const [saving_retention, setSavingRetention] = useState(false);

  const load = () => {
    get_approval_schedule(form_group_id)
      .then((response) => {
        const data = response.data || {};
        setApprovers(data.approvers || []);
        setSchedule(data.schedule || null);
        setRequests(data.requests || []);
        setRetention(data.approved_retention || data.approved_retention_default || "month");
        setRetentionConfigured(!!data.approved_retention);
        if (data.schedule) {
          setMode(data.schedule.trigger.type);
          if (data.schedule.trigger.type === "count") setCount(data.schedule.trigger.count);
          if (data.schedule.trigger.type === "datetime") {
            // datetime-local inputs want local time without a timezone suffix.
            const moment = new Date(data.schedule.trigger.datetime);
            const pad = (n) => String(n).padStart(2, "0");
            setDatetime(`${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}T${pad(moment.getHours())}:${pad(moment.getMinutes())}`);
          }
        }
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form_group_id]);

  const handle_save_retention = async () => {
    setSavingRetention(true);
    try {
      const response = await save_approval_settings(form_group_id, retention);
      showSuccess(response.message || translate("DCS_SCHED_SAVED"));
      setRetentionConfigured(true);
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSavingRetention(false);
    }
  };

  const has_approvers = approvers.length > 0;

  const handle_action = async () => {
    if (mode === "count" && (!Number.isFinite(Number(count)) || Number(count) < 1)) return;
    if (mode === "datetime" && !datetime) return;

    setActing(true);
    try {
      if (mode === "now") {
        const response = await send_approval_links_now(form_group_id);
        showSuccess(response.message || translate("DCS_SCHED_SENT"));
      } else {
        const trigger = mode === "count" ? { type: "count", count: Number(count) } : { type: "datetime", datetime: new Date(datetime).toISOString() };
        const response = await save_approval_schedule(form_group_id, trigger, retention);
        showSuccess(response.message || translate("DCS_SCHED_SAVED"));
      }
      if (onChanged) onChanged();
      load();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setActing(false);
    }
  };

  const handle_cancel_schedule = async () => {
    setActing(true);
    try {
      const response = await cancel_approval_schedule(form_group_id);
      showSuccess(response.message || translate("DCS_SCHED_CANCELLED"));
      setSchedule(null);
      if (onChanged) onChanged();
      load();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setActing(false);
    }
  };

  const head = (
    <div>
      <p className="text-base font-bold uppercase" style={{ color: PRIMARY, fontFamily: FONT, letterSpacing: "0.5px" }}>
        {translate("DCS_SCHED_TITLE")}
      </p>
      <p className="text-xs mt-0.5" style={{ color: FADED, fontFamily: FONT }}>
        {translate("DCS_SCHED_APPROVERS_HINT")}
      </p>
    </div>
  );

  const body = (
        <div>
          {/* Shaped like the two columns of settings that are coming,
              so the page does not jump when they land. */}
          {load_state === "loading" && <TwoColumnSkeleton />}
          {load_state === "error" && (
            <p className="text-sm" style={{ color: "#E74C3C", fontFamily: FONT }}>
              {translate("DCS_ERROR_GENERIC")}
            </p>
          )}

          {load_state === "ready" && (
            <>
              {schedule && (
                <div
                  className="flex items-center gap-3 px-4 py-3 mb-5 flex-wrap"
                  style={{ backgroundColor: "rgba(5,109,170,0.06)", borderLeft: `4px solid ${PRIMARY}` }}
                >
                  <span style={{ color: PRIMARY }}>{MODE_ICONS.datetime}</span>
                  <p className="text-sm flex-1 min-w-0" style={{ color: TEXT, fontFamily: FONT }}>
                    {schedule.trigger.type === "count"
                      ? translate("DCS_SCHED_ACTIVE_COUNT", { count: schedule.trigger.count })
                      : translate("DCS_SCHED_ACTIVE_DATETIME", { datetime: new Date(schedule.trigger.datetime).toLocaleString() })}
                  </p>
                  <button
                    type="button"
                    onClick={handle_cancel_schedule}
                    disabled={acting}
                    className="text-xs font-bold uppercase cursor-pointer whitespace-nowrap px-2 py-1"
                    style={{ color: "#E74C3C", fontFamily: FONT, border: "1px solid rgba(231,76,60,0.4)", background: "none" }}
                  >
                    {translate("DCS_SCHED_CANCEL")}
                  </button>
                </div>
              )}

              {/* Two columns on wide screens, stacked on narrow ones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section>
                  <SectionLabel>{translate("DCS_SCHED_APPROVERS")}</SectionLabel>
                  {has_approvers ? (
                    <ApproverChain
                      approvers={approvers}
                      formGroupId={form_group_id}
                      onCopied={() => showSuccess(translate("DCS_SCHED_LINK_COPIED"))}
                      onFailed={(message) => showError(message || translate("DCS_ERROR_GENERIC"))}
                    />
                  ) : (
                    <p className="text-sm px-3 py-2.5" style={{ backgroundColor: "rgba(243,156,18,0.08)", borderLeft: "4px solid #F39C12", color: "#B9770E", fontFamily: FONT }}>
                      {translate("DCS_SCHED_NO_APPROVERS")}
                    </p>
                  )}
                </section>

                <section>
                  <SectionLabel>{translate("DCS_SCHED_WHEN")}</SectionLabel>
                  <div className="flex flex-col gap-2.5">
                    <SendModeOption value="now" mode={mode} onSelect={setMode} labelKey="DCS_SCHED_SEND_NOW" hintKey="DCS_SCHED_SEND_NOW_HINT" />
                    <SendModeOption value="count" mode={mode} onSelect={setMode} labelKey="DCS_SCHED_ON_COUNT" hintKey="DCS_SCHED_ON_COUNT_HINT">
                      <input type="number" min={1} value={count} onChange={(event) => setCount(event.target.value)} style={{ ...INPUT_STYLE, maxWidth: 140 }} />
                    </SendModeOption>
                    <SendModeOption value="datetime" mode={mode} onSelect={setMode} labelKey="DCS_SCHED_ON_DATETIME" hintKey="DCS_SCHED_ON_DATETIME_HINT">
                      <input type="datetime-local" value={datetime} onChange={(event) => setDatetime(event.target.value)} style={{ ...INPUT_STYLE, maxWidth: 240 }} />
                    </SendModeOption>
                  </div>
                </section>
              </div>

              <section className="mt-6">
                <SectionLabel>{translate("DCS_SCHED_RETENTION")}</SectionLabel>
                <div className="flex flex-wrap items-center gap-2">
                  {["week", "month", "year"].map((window_key) => (
                    <button
                      key={window_key}
                      type="button"
                      disabled={acting}
                      onClick={() => setRetention(window_key)}
                      className="text-xs font-bold uppercase cursor-pointer px-3 py-2"
                      style={{
                        fontFamily: FONT,
                        letterSpacing: 0.5,
                        border: "1px solid #056daa",
                        backgroundColor: retention === window_key ? "#056daa" : "transparent",
                        color: retention === window_key ? "#FFFFFF" : "#056daa",
                      }}
                    >
                      {translate("DCS_SCHED_RETENTION_" + window_key.toUpperCase())}
                    </button>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: FADED, fontFamily: FONT }}>
                  {translate("DCS_SCHED_RETENTION_HINT")}
                  {!retention_configured ? " " + translate("DCS_SCHED_RETENTION_LEGACY") : ""}
                </p>
                <button
                  type="button"
                  onClick={handle_save_retention}
                  disabled={saving_retention || acting}
                  className="mt-3 text-xs font-bold uppercase cursor-pointer px-4 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ fontFamily: FONT, letterSpacing: 0.5, backgroundColor: "#056daa", color: "#FFFFFF", border: "none" }}
                >
                  {saving_retention ? translate("DCS_SCHED_SAVING") : translate("DCS_SCHED_RETENTION_SAVE")}
                </button>
              </section>

              <section className="mt-6">
                <SectionLabel>{translate("DCS_SCHED_HISTORY")}</SectionLabel>
                {requests.length === 0 ? (
                  <p className="text-sm px-3 py-2.5" style={{ color: FADED, backgroundColor: "#F7F9FB", fontFamily: FONT }}>
                    {translate("DCS_SCHED_HISTORY_EMPTY")}
                  </p>
                ) : (
                  <div className="flex flex-col" style={{ border: `1px solid ${BORDER}` }}>
                    {requests.map((request, request_index) => (
                      <div
                        key={request._id}
                        className="px-4 py-2.5"
                        style={{ borderTop: request_index > 0 ? `1px solid ${BORDER}` : "none", backgroundColor: request_index % 2 === 1 ? "#F7F9FB" : "#FFFFFF" }}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-semibold" style={{ color: TEXT, fontFamily: FONT }}>
                            {new Date(request.created_at).toLocaleString()}
                            <span style={{ color: FADED, fontWeight: 400 }}> - {translate("DCS_SCHED_RECORDS", { count: request.submission_count })}</span>
                          </p>
                          <DcsApprovalStatusChip status={request.status} />
                        </div>
                        <p className="text-xs mt-1" style={{ color: FADED, fontFamily: FONT }}>
                          {request.approvers.map((approver) => `${approver.email} (${approver.status})`).join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
  );

  const submit_button =
    load_state === "ready" ? (
      <DcsButtonPrimary onClick={handle_action} disabled={acting || !has_approvers}>
        {acting ? translate("DCS_SCHED_WORKING") : translate(mode === "now" ? "DCS_SCHED_SEND_NOW" : "DCS_SCHED_SAVE")}
      </DcsButtonPrimary>
    ) : null;

  if (asPage) {
    return (
      <div className="bg-white border-2" style={{ borderColor: "#E0E0E0" }}>
        <div className="px-4 sm:px-6 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>{head}</div>
        <div className="px-4 sm:px-6 py-5">{body}</div>
        {submit_button && (
          <div className="flex justify-end px-4 sm:px-6 py-4" style={{ borderTop: `1px solid ${BORDER}` }}>
            <div className="w-full min-[480px]:w-56">{submit_button}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={acting ? undefined : onClose} />
      <div className="relative bg-white border-2 w-full flex flex-col" style={{ maxWidth: 880, maxHeight: "90vh", borderColor: PRIMARY }}>
        <div className="flex items-start justify-between gap-4 px-6 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
          {head}
          <button
            type="button"
            onClick={acting ? undefined : onClose}
            aria-label={translate("DCS_BTN_CLOSE")}
            className="cursor-pointer flex-shrink-0 flex items-center justify-center"
            style={{ width: 32, height: 32, color: FADED }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">{body}</div>
        <div className="flex justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${BORDER}` }}>
          <DcsButtonOutline onClick={onClose} disabled={acting}>
            {translate("DCS_BTN_CLOSE")}
          </DcsButtonOutline>
          {submit_button}
        </div>
      </div>
    </div>
  );
}
