import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_APPROVERS = 20;

const EMPTY_APPROVER = { name: "", role: "", email: "", on_reject: "stop" };

// Client-side mirror of the backend's approval_config validation.
export function is_approval_config_complete(config) {
  if (!config || config.enabled !== true) return true;
  if (!Array.isArray(config.approvers) || config.approvers.length === 0) return false;
  return config.approvers.every(
    (approver) => approver.name.trim() && approver.role.trim() && EMAIL_REGEX.test(approver.email.trim()),
  );
}

const input_style = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: 13,
  color: "#333333",
  border: "1px solid #E0E0E0",
  padding: "8px 10px",
  width: "100%",
  outline: "none",
  backgroundColor: "#FFFFFF",
};

const label_style = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "#9E9E9E",
  display: "block",
  marginBottom: 4,
};

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
    <div className="border-2 p-4 mt-4" style={{ borderColor: "#E0E0E0" }}>
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input type="checkbox" checked={enabled} onChange={handle_toggle} style={{ width: 16, height: 16, accentColor: "#056daa" }} />
        <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 14, color: "#333333" }}>
          {translate("DCS_APPROVAL_ENABLE_LABEL")}
        </span>
      </label>
      <p className="mt-1 text-xs" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
        {translate("DCS_APPROVAL_ENABLE_HINT")}
      </p>

      {enabled && (
        <div className="mt-4 space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div style={{ minWidth: 180 }}>
              <span style={label_style}>{translate("DCS_APPROVAL_COUNT_LABEL")}</span>
              <input
                type="number"
                min={1}
                max={MAX_APPROVERS}
                value={approvers.length}
                onChange={(event) => handle_count_change(event.target.value)}
                style={input_style}
              />
            </div>
            <div style={{ minWidth: 260, flex: 1 }}>
              <span style={label_style}>{translate("DCS_APPROVAL_MODE_LABEL")}</span>
              <select value={mode} onChange={(event) => emit({ enabled: true, mode: event.target.value, approvers })} style={input_style}>
                <option value="sequential">{translate("DCS_APPROVAL_MODE_SEQUENTIAL")}</option>
                <option value="parallel">{translate("DCS_APPROVAL_MODE_PARALLEL")}</option>
              </select>
            </div>
          </div>

          {approvers.map((approver, index) => {
            const email_invalid = approver.email.trim() !== "" && !EMAIL_REGEX.test(approver.email.trim());
            return (
              <div key={index} className="border p-3" style={{ borderColor: "#E0E0E0", backgroundColor: "#F7F9FB" }}>
                <p className="mb-2" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 13, color: "#056daa" }}>
                  {translate("DCS_APPROVAL_APPROVER_TITLE", { number: index + 1 })}
                </p>
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                  <div>
                    <span style={label_style}>{translate("DCS_APPROVAL_FIELD_NAME")}</span>
                    <input value={approver.name} onChange={(event) => handle_approver_change(index, "name", event.target.value)} style={input_style} />
                  </div>
                  <div>
                    <span style={label_style}>{translate("DCS_APPROVAL_FIELD_ROLE")}</span>
                    <input value={approver.role} onChange={(event) => handle_approver_change(index, "role", event.target.value)} style={input_style} />
                  </div>
                  <div>
                    <span style={label_style}>{translate("DCS_APPROVAL_FIELD_EMAIL")}</span>
                    <input
                      type="email"
                      value={approver.email}
                      onChange={(event) => handle_approver_change(index, "email", event.target.value)}
                      style={Object.assign({}, input_style, email_invalid ? { borderColor: "#E74C3C" } : null)}
                    />
                  </div>
                  <div>
                    <span style={label_style}>{translate("DCS_APPROVAL_ON_REJECT_LABEL")}</span>
                    <select value={approver.on_reject} onChange={(event) => handle_approver_change(index, "on_reject", event.target.value)} style={input_style}>
                      <option value="stop">{translate("DCS_APPROVAL_ON_REJECT_STOP")}</option>
                      <option value="continue">{translate("DCS_APPROVAL_ON_REJECT_CONTINUE")}</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}

          {!is_approval_config_complete({ enabled: true, mode, approvers }) && (
            <p className="text-xs px-3 py-2" style={{ backgroundColor: "rgba(243,156,18,0.12)", color: "#F39C12", fontFamily: "'Montserrat', sans-serif" }}>
              {translate("DCS_APPROVAL_CONFIG_INCOMPLETE")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
