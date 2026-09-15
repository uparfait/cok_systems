import React, { useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsButtonPrimary from "../../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";

const TEXT_MUTED = "#9E9E9E";
const FONT = { fontFamily: "'Montserrat', sans-serif" };

/** "2026-09-15T10:30:00.000Z" -> the local value a datetime-local input takes. */
function to_local_input(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * The fields of one share link: a title (required), a description, and
 * the expiry - a date and time, or "never expires". Used to create a link
 * and to edit an existing one.
 */
export default function LinkForm({ initial, saving, onSubmit, onCancel }) {
  const { translate } = useDcsLanguage();
  const [title, setTitle] = useState((initial && initial.title) || "");
  const [description, setDescription] = useState((initial && initial.description) || "");
  const [never, setNever] = useState(!(initial && initial.expires_at));
  const [expires_at, setExpiresAt] = useState(to_local_input(initial && initial.expires_at));
  const [problem, setProblem] = useState("");

  const submit = (event) => {
    event.preventDefault();
    setProblem("");
    if (!title.trim()) {
      setProblem(translate("DCS_DB_SHARE_TITLE_REQUIRED"));
      return;
    }
    if (!never) {
      const date = new Date(expires_at);
      if (!expires_at || Number.isNaN(date.getTime())) {
        setProblem(translate("DCS_DB_SHARE_EXPIRY_REQUIRED"));
        return;
      }
      if (date.getTime() <= Date.now()) {
        setProblem(translate("DCS_DB_SHARE_EXPIRY_PAST"));
        return;
      }
    }
    onSubmit({ title: title.trim(), description: description.trim(), never_expires: never, expires_at: never ? null : new Date(expires_at).toISOString() });
  };

  return (
    <form onSubmit={submit} className="space-y-3 border-2 p-4" style={{ borderColor: "#056daa", backgroundColor: "rgba(5,109,170,0.04)" }}>
      <div>
        <label className="cok-auth-label">{translate("DCS_DB_SHARE_LINK_TITLE")}</label>
        <input className="cok-auth-input w-full py-2" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder={translate("DCS_DB_SHARE_TITLE_PLACEHOLDER")} autoFocus />
      </div>
      <div>
        <label className="cok-auth-label">{translate("DCS_DB_SHARE_LINK_DESCRIPTION")}</label>
        <textarea className="cok-auth-input w-full py-2" rows={2} value={description} maxLength={300} onChange={(event) => setDescription(event.target.value)} placeholder={translate("DCS_DB_SHARE_DESCRIPTION_PLACEHOLDER")} />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={FONT}>
          <input type="checkbox" checked={never} style={{ accentColor: "#056daa" }} onChange={(event) => setNever(event.target.checked)} />
          {translate("DCS_DB_SHARE_NEVER")}
        </label>
        {!never && (
          <div className="flex-1">
            <label className="cok-auth-label">{translate("DCS_DB_SHARE_EXPIRES")}</label>
            <input type="datetime-local" className="cok-auth-input w-full py-2" value={expires_at} min={to_local_input(new Date())} onChange={(event) => setExpiresAt(event.target.value)} />
          </div>
        )}
      </div>
      <p className="text-xs" style={{ color: TEXT_MUTED }}>
        {translate("DCS_DB_SHARE_FORM_HINT")}
      </p>
      {problem && (
        <p className="text-xs" style={{ color: "#E74C3C" }}>
          {problem}
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <DcsButtonPrimary type="submit" className="flex-1" disabled={saving}>
          {saving ? translate("DCS_WAITING_GENERIC") : translate("DCS_DB_SHARE_SAVE")}
        </DcsButtonPrimary>
        <DcsButtonOutline className="flex-1" onClick={onCancel} disabled={saving}>
          {translate("DCS_BTN_CANCEL")}
        </DcsButtonOutline>
      </div>
    </form>
  );
}
