import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const EXPIRY_OPTIONS = [
  { value: "never", labelKey: "DCS_FEED_EXPIRY_NEVER" },
  { value: "7d", labelKey: "DCS_FEED_EXPIRY_7D" },
  { value: "30d", labelKey: "DCS_FEED_EXPIRY_30D" },
  { value: "90d", labelKey: "DCS_FEED_EXPIRY_90D" },
  { value: "365d", labelKey: "DCS_FEED_EXPIRY_365D" },
  { value: "custom", labelKey: "DCS_FEED_EXPIRY_CUSTOM" },
];

export default function DcsDataFeedForm({ versions, saving, onSubmit, onCancel }) {
  const { translate } = useDcsLanguage();
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("never");
  const [expiry_date, setExpiryDate] = useState("");
  const [version, setVersion] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const valid = name.trim().length > 0 && (expiry !== "custom" || expiry_date);

  const submit = () => {
    if (!valid || saving) return;
    onSubmit({
      name: name.trim(),
      expires_in: expiry === "custom" ? expiry_date : expiry,
      scope: { version: version === "" ? null : Number(version), from: from || null, to: to || null },
    });
  };

  return (
    <div className="space-y-3 p-4 cok-auth-card bg-white">
      <div>
        <label className="cok-auth-label" htmlFor="dcs_feed_name">
          {translate("DCS_FEED_NAME")}
          <span style={{ color: "#E74C3C" }}> *</span>
        </label>
        <input id="dcs_feed_name" className="cok-auth-input w-full" style={{ paddingLeft: 14, ...FONT }} value={name} placeholder={translate("DCS_FEED_NAME_PLACEHOLDER")} onChange={(event) => setName(event.target.value)} disabled={saving} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="cok-auth-label">{translate("DCS_FEED_EXPIRY")}</label>
          <select className="cok-auth-input w-full cursor-pointer" style={{ paddingLeft: 14, ...FONT }} value={expiry} onChange={(event) => setExpiry(event.target.value)} disabled={saving}>
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {translate(option.labelKey)}
              </option>
            ))}
          </select>
          {expiry === "custom" && <input type="date" className="cok-auth-input w-full mt-2" style={{ paddingLeft: 14 }} value={expiry_date} onChange={(event) => setExpiryDate(event.target.value)} disabled={saving} />}
        </div>
        <div>
          <label className="cok-auth-label">{translate("DCS_FEED_SCOPE_VERSION")}</label>
          <select className="cok-auth-input w-full cursor-pointer" style={{ paddingLeft: 14, ...FONT }} value={version} onChange={(event) => setVersion(event.target.value)} disabled={saving}>
            <option value="">{translate("DCS_FEED_ALL_VERSIONS")}</option>
            {(versions || []).map((entry) => (
              <option key={entry.version} value={entry.version}>
                {translate("DCS_FEED_VERSION_N", { version: entry.version })}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="cok-auth-label">{translate("DCS_FEED_SCOPE_DATES")}</label>
        <div className="flex gap-2">
          <input type="date" className="cok-auth-input flex-1 min-w-0" style={{ paddingLeft: 14 }} value={from} onChange={(event) => setFrom(event.target.value)} disabled={saving} />
          <input type="date" className="cok-auth-input flex-1 min-w-0" style={{ paddingLeft: 14 }} value={to} onChange={(event) => setTo(event.target.value)} disabled={saving} />
        </div>
        <p className="text-xs mt-1" style={{ color: "#9E9E9E", ...FONT }}>
          {translate("DCS_FEED_SCOPE_HINT")}
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <DcsButtonOutline onClick={onCancel} disabled={saving}>
          {translate("DCS_BTN_CANCEL")}
        </DcsButtonOutline>
        <DcsButtonPrimary onClick={submit} disabled={!valid || saving}>
          {saving ? translate("DCS_WAITING_GENERIC") : translate("DCS_FEED_CREATE")}
        </DcsButtonPrimary>
      </div>
    </div>
  );
}
