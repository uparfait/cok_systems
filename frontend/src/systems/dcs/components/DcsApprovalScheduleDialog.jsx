import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import {
  get_approval_schedule,
  save_approval_schedule,
  cancel_approval_schedule,
  send_approval_links_now,
} from "../services/approvalsService.js";
import DcsApprovalStatusChip from "./DcsApprovalStatusChip.jsx";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const BORDER = "#E0E0E0";
const PRIMARY = "#056daa";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INPUT_STYLE = {
  border: `1px solid ${BORDER}`,
  padding: "8px 10px",
  fontFamily: "'Montserrat', sans-serif",
  fontSize: 14,
  color: "#333333",
  width: "100%",
};

/** One choice of when the links go out: right now, after N responses, or at a date and time. */
function SendModeOption({ value, mode, onSelect, labelKey, hintKey, children }) {
  const { translate } = useDcsLanguage();
  const is_selected = mode === value;
  return (
    <label className="block border px-3 py-2.5 cursor-pointer" style={{ borderColor: is_selected ? PRIMARY : BORDER, backgroundColor: is_selected ? "#F7F9FB" : "#FFFFFF" }}>
      <span className="flex items-center gap-2">
        <input type="radio" name="dcs_send_mode" checked={is_selected} onChange={() => onSelect(value)} />
        <span className="text-sm font-semibold" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
          {translate(labelKey)}
        </span>
      </span>
      {hintKey && (
        <span className="block text-xs mt-1 ml-5" style={{ color: "#9E9E9E" }}>
          {translate(hintKey)}
        </span>
      )}
      {is_selected && children && <span className="block mt-2 ml-5">{children}</span>}
    </label>
  );
}

/**
 * The data page's "Schedule approval" dialog: the form author lists the
 * approvers' emails, then either sends them their approval links (with a
 * one-time code each) right now, or schedules the send to fire after N
 * collected responses or at a chosen date and time. Also shows the
 * schedule currently waiting and the batches already sent.
 */
export default function DcsApprovalScheduleDialog({ form_group_id, onClose, onChanged }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();

  const [load_state, setLoadState] = useState("loading");
  const [schedule, setSchedule] = useState(null);
  const [requests, setRequests] = useState([]);
  const [approvers, setApprovers] = useState([{ name: "", email: "" }]);
  const [mode, setMode] = useState("now");
  const [count, setCount] = useState(10);
  const [datetime, setDatetime] = useState("");
  const [acting, setActing] = useState(false);

  const load = () => {
    get_approval_schedule(form_group_id)
      .then((response) => {
        const data = response.data || {};
        setSchedule(data.schedule || null);
        setRequests(data.requests || []);
        if (data.schedule) {
          setApprovers(data.schedule.approvers.length > 0 ? data.schedule.approvers.map((a) => ({ name: a.name || "", email: a.email })) : [{ name: "", email: "" }]);
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

  const valid_approvers = approvers.filter((approver) => EMAIL_REGEX.test((approver.email || "").trim()));

  const update_approver = (index, field, value) => {
    setApprovers((previous) => previous.map((approver, i) => (i === index ? { ...approver, [field]: value } : approver)));
  };

  const handle_action = async () => {
    if (valid_approvers.length === 0) {
      showError(translate("DCS_SCHED_EMAIL_REQUIRED"));
      return;
    }
    if (mode === "count" && (!Number.isFinite(Number(count)) || Number(count) < 1)) return;
    if (mode === "datetime" && !datetime) return;

    setActing(true);
    try {
      if (mode === "now") {
        const response = await send_approval_links_now(form_group_id, valid_approvers);
        showSuccess(response.message || translate("DCS_SCHED_SENT"));
      } else {
        const trigger = mode === "count" ? { type: "count", count: Number(count) } : { type: "datetime", datetime: new Date(datetime).toISOString() };
        const response = await save_approval_schedule(form_group_id, valid_approvers, trigger);
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

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={acting ? undefined : onClose} />
      <div className="relative bg-white border-2 w-full flex flex-col" style={{ maxWidth: 560, maxHeight: "90vh", borderColor: PRIMARY }}>
        <p className="text-base font-bold uppercase px-6 pt-5 pb-3" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
          {translate("DCS_SCHED_TITLE")}
        </p>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
          {load_state === "loading" && <SpiralLoader />}
          {load_state === "error" && (
            <p className="text-sm" style={{ color: "#E74C3C" }}>
              {translate("DCS_ERROR_GENERIC")}
            </p>
          )}

          {load_state === "ready" && (
            <>
              {schedule && (
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 mb-4" style={{ backgroundColor: "rgba(5,109,170,0.08)", border: `1px solid ${PRIMARY}` }}>
                  <p className="text-sm" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
                    {schedule.trigger.type === "count"
                      ? translate("DCS_SCHED_ACTIVE_COUNT", { count: schedule.trigger.count })
                      : translate("DCS_SCHED_ACTIVE_DATETIME", { datetime: new Date(schedule.trigger.datetime).toLocaleString() })}
                  </p>
                  <button type="button" onClick={handle_cancel_schedule} disabled={acting} className="text-xs font-bold uppercase cursor-pointer whitespace-nowrap" style={{ color: "#E74C3C", fontFamily: "'Montserrat', sans-serif" }}>
                    {translate("DCS_SCHED_CANCEL")}
                  </button>
                </div>
              )}

              <p className="text-xs font-bold uppercase mb-2" style={{ color: "#555555", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
                {translate("DCS_SCHED_APPROVERS")}
              </p>
              <div className="flex flex-col gap-2 mb-2">
                {approvers.map((approver, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input type="text" value={approver.name} onChange={(event) => update_approver(index, "name", event.target.value)} placeholder={translate("DCS_SCHED_APPROVER_NAME")} style={{ ...INPUT_STYLE, flex: 2 }} />
                    <input type="email" value={approver.email} onChange={(event) => update_approver(index, "email", event.target.value)} placeholder={translate("DCS_SCHED_APPROVER_EMAIL")} style={{ ...INPUT_STYLE, flex: 3 }} />
                    <button
                      type="button"
                      onClick={() => setApprovers((previous) => (previous.length > 1 ? previous.filter((_, i) => i !== index) : [{ name: "", email: "" }]))}
                      aria-label={translate("DCS_BTN_DELETE")}
                      className="cursor-pointer flex-shrink-0"
                      style={{ color: "#E74C3C", fontSize: 18, lineHeight: 1, padding: "0 4px" }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setApprovers((previous) => [...previous, { name: "", email: "" }])} className="text-xs font-bold uppercase cursor-pointer mb-4" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>
                + {translate("DCS_SCHED_ADD_APPROVER")}
              </button>

              <p className="text-xs font-bold uppercase mb-2" style={{ color: "#555555", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
                {translate("DCS_SCHED_WHEN")}
              </p>
              <div className="flex flex-col gap-2 mb-4">
                <SendModeOption value="now" mode={mode} onSelect={setMode} labelKey="DCS_SCHED_SEND_NOW" hintKey="DCS_SCHED_SEND_NOW_HINT" />
                <SendModeOption value="count" mode={mode} onSelect={setMode} labelKey="DCS_SCHED_ON_COUNT" hintKey="DCS_SCHED_ON_COUNT_HINT">
                  <input type="number" min={1} value={count} onChange={(event) => setCount(event.target.value)} style={{ ...INPUT_STYLE, maxWidth: 140 }} />
                </SendModeOption>
                <SendModeOption value="datetime" mode={mode} onSelect={setMode} labelKey="DCS_SCHED_ON_DATETIME" hintKey="DCS_SCHED_ON_DATETIME_HINT">
                  <input type="datetime-local" value={datetime} onChange={(event) => setDatetime(event.target.value)} style={{ ...INPUT_STYLE, maxWidth: 240 }} />
                </SendModeOption>
              </div>

              <p className="text-xs font-bold uppercase mb-2" style={{ color: "#555555", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
                {translate("DCS_SCHED_HISTORY")}
              </p>
              {requests.length === 0 ? (
                <p className="text-sm mb-2" style={{ color: "#9E9E9E" }}>
                  {translate("DCS_SCHED_HISTORY_EMPTY")}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {requests.map((request) => (
                    <div key={request._id} className="border px-3 py-2" style={{ borderColor: BORDER }}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
                          {new Date(request.created_at).toLocaleString()} - {translate("DCS_SCHED_RECORDS", { count: request.submission_count })}
                        </p>
                        <DcsApprovalStatusChip status={request.status} />
                      </div>
                      <p className="text-xs mt-1" style={{ color: "#9E9E9E" }}>
                        {request.approvers.map((approver) => `${approver.email} (${approver.status})`).join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-5">
          <DcsButtonOutline className="flex-1" onClick={onClose} disabled={acting}>
            {translate("DCS_BTN_CLOSE")}
          </DcsButtonOutline>
          {load_state === "ready" && (
            <DcsButtonPrimary className="flex-1" onClick={handle_action} disabled={acting}>
              {acting ? translate("DCS_SCHED_WORKING") : translate(mode === "now" ? "DCS_SCHED_SEND_NOW" : "DCS_SCHED_SAVE")}
            </DcsButtonPrimary>
          )}
        </div>
      </div>
    </div>
  );
}
