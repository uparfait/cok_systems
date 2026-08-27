import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_APPROVERS = 20;

const EMPTY_APPROVER = { name: "", role: "", email: "", on_reject: "stop" };

// Same input/label styling as the event manager forms (RoomForm & co).
const INPUT_CLASS =
  "w-full px-4 py-2.5 border border-gray-300 ppp-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200";
const LABEL_CLASS = "block text-sm font-medium text-gray-700";

// Client-side mirror of the backend's approval_config validation.
export function is_approval_config_complete(config) {
  if (!config || config.enabled !== true) return true;
  if (!Array.isArray(config.approvers) || config.approvers.length === 0) return false;
  return config.approvers.every(
    (approver) => approver.name.trim() && approver.role.trim() && EMAIL_REGEX.test(approver.email.trim()),
  );
}

// Optional pre-publish step: the form owner defines who must approve each submitted response.
export default function ApprovalFlowSection({ value, onChange }) {
  const { translate } = useDcsLanguage();
  const enabled = !!value && value.enabled === true;
  const mode = (value && value.mode) || "sequential";
  const approvers = (value && value.approvers) || [];

  const emit = (next) => onChange(next);

  const handle_toggle = () => {
    if (enabled) emit(null);
    else emit({ enabled: true, mode: "sequential", approvers: [Object.assign({}, EMPTY_APPROVER)] });
  };

  const handle_count_change = (raw_count) => {
    const count = Math.max(1, Math.min(MAX_APPROVERS, Number(raw_count) || 1));
    const next_approvers = Array.from({ length: count }, (_, index) => approvers[index] || Object.assign({}, EMPTY_APPROVER));
    emit({ enabled: true, mode, approvers: next_approvers });
  };

  const handle_approver_change = (index, key, field_value) => {
    const next_approvers = approvers.map((approver, i) => (i === index ? Object.assign({}, approver, { [key]: field_value }) : approver));
    emit({ enabled: true, mode, approvers: next_approvers });
  };

  return (
    <div className="bg-white border border-gray-200 ppp-xl mt-4">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="approval-flow-toggle"
            checked={enabled}
            onChange={handle_toggle}
            className="w-4 h-4 text-blue-600 border-gray-300 ppp focus:ring-blue-500"
          />
          <label htmlFor="approval-flow-toggle" className="text-lg font-bold text-gray-900 cursor-pointer select-none">
            {translate("DCS_APPROVAL_ENABLE_LABEL")}
          </label>
        </div>
      </div>

      <div className="px-6 py-3">
        <p className="text-sm text-gray-500">{translate("DCS_APPROVAL_ENABLE_HINT")}</p>
      </div>

      {enabled && (
        <div className="px-6 pb-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="approval-count" className={LABEL_CLASS}>
                {translate("DCS_APPROVAL_COUNT_LABEL")} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="approval-count"
                min={1}
                max={MAX_APPROVERS}
                value={approvers.length}
                onChange={(event) => handle_count_change(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="approval-mode" className={LABEL_CLASS}>
                {translate("DCS_APPROVAL_MODE_LABEL")} <span className="text-red-500">*</span>
              </label>
              <select
                id="approval-mode"
                value={mode}
                onChange={(event) => emit({ enabled: true, mode: event.target.value, approvers })}
                className={INPUT_CLASS}
              >
                <option value="sequential">{translate("DCS_APPROVAL_MODE_SEQUENTIAL")}</option>
                <option value="parallel">{translate("DCS_APPROVAL_MODE_PARALLEL")}</option>
              </select>
            </div>
          </div>

          {approvers.map((approver, index) => {
            const email_invalid = approver.email.trim() !== "" && !EMAIL_REGEX.test(approver.email.trim());
            return (
              <div key={index} className="border border-gray-200 ppp-lg p-5 space-y-4 bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 ppp-full bg-blue-600 text-white text-xs font-bold">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-bold text-gray-900">
                    {translate("DCS_APPROVAL_APPROVER_TITLE", { number: index + 1 })}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={LABEL_CLASS}>
                      {translate("DCS_APPROVAL_FIELD_NAME")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={approver.name}
                      onChange={(event) => handle_approver_change(index, "name", event.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={LABEL_CLASS}>
                      {translate("DCS_APPROVAL_FIELD_ROLE")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={approver.role}
                      onChange={(event) => handle_approver_change(index, "role", event.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={LABEL_CLASS}>
                      {translate("DCS_APPROVAL_FIELD_EMAIL")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={approver.email}
                      onChange={(event) => handle_approver_change(index, "email", event.target.value)}
                      className={`${INPUT_CLASS} ${email_invalid ? "border-red-400 focus:border-red-500 focus:ring-red-500" : ""}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={LABEL_CLASS}>{translate("DCS_APPROVAL_ON_REJECT_LABEL")}</label>
                    <select
                      value={approver.on_reject}
                      onChange={(event) => handle_approver_change(index, "on_reject", event.target.value)}
                      className={INPUT_CLASS}
                    >
                      <option value="stop">{translate("DCS_APPROVAL_ON_REJECT_STOP")}</option>
                      <option value="continue">{translate("DCS_APPROVAL_ON_REJECT_CONTINUE")}</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}

          {!is_approval_config_complete({ enabled: true, mode, approvers }) && (
            <div className="bg-amber-50 border border-amber-200 ppp-lg p-3">
              <p className="text-sm text-amber-600">{translate("DCS_APPROVAL_CONFIG_INCOMPLETE")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
