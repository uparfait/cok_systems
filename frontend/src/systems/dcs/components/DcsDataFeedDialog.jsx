import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { list_data_tokens, create_data_token, rotate_data_token, delete_data_token, data_feed_url } from "../services/dataFeedService.js";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";
import DcsConfirmDialog from "./DcsConfirmDialog.jsx";
import DcsDataFeedForm from "./DcsDataFeedForm.jsx";

const FONT = { fontFamily: "'Montserrat', sans-serif" };
const MUTED = "#9E9E9E";
const TEXT = "#333333";
const PRIMARY = "#056daa";

function UrlRow({ label, url, onCopy }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-bold uppercase flex-shrink-0" style={{ color: MUTED, width: 52, ...FONT }}>
        {label}
      </span>
      <p className="text-[11px] break-all px-2 py-1.5 flex-1 min-w-0" style={{ color: TEXT, backgroundColor: "#F7F9FB", fontFamily: "monospace" }}>
        {url}
      </p>
      <button type="button" className="text-xs font-bold uppercase cursor-pointer bg-transparent border-0 flex-shrink-0" style={{ color: PRIMARY, ...FONT }} onClick={onCopy}>
        Copy
      </button>
    </div>
  );
}

/**
 * Sharing a form's data with an analysis tool: the read-only links it
 * hands out, and the tokens behind them. Used as the dialog it has
 * always been, and - with asPage - as the body of the Share page
 * reached from the form's workspace panel, where this IS the work of
 * the page and an overlay would only sit on top of something unrelated.
 */
export default function DcsDataFeedDialog({ formGroupId, versions, onClose, asPage }) {
  const { translate, language } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [show_steps, setShowSteps] = useState(false);

  const reload = () =>
    list_data_tokens(formGroupId)
      .then((response) => setTokens((response.data && response.data.tokens) || []))
      .catch((error) => showError(error.message || translate("DCS_ERROR_GENERIC")))
      .finally(() => setLoading(false));

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formGroupId]);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showSuccess(translate("DCS_FEED_COPIED"));
    } catch (error) {
      showError(translate("DCS_ERROR_GENERIC"));
    }
  };

  const create = async (fields) => {
    setSaving(true);
    try {
      const response = await create_data_token(formGroupId, fields);
      showSuccess(response.message || translate("DCS_FEED_CREATED"));
      setCreating(false);
      await reload();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSaving(false);
    }
  };

  const rotate = async (token) => {
    setSaving(true);
    try {
      const response = await rotate_data_token(formGroupId, token.id);
      showSuccess(response.message || translate("DCS_FEED_ROTATED"));
      await reload();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSaving(false);
    }
  };

  const revoke = async () => {
    if (!revoking) return;
    setSaving(true);
    try {
      const response = await delete_data_token(formGroupId, revoking.id);
      showSuccess(response.message || translate("DCS_FEED_REVOKED"));
      setRevoking(null);
      await reload();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSaving(false);
    }
  };

  const expiry_text = (token) => {
    if (!token.expires_at) return translate("DCS_FEED_EXPIRY_NEVER");
    const date = new Date(token.expires_at).toLocaleDateString(language);
    return token.expired ? translate("DCS_FEED_EXPIRED_ON", { date }) : translate("DCS_FEED_EXPIRES_ON", { date });
  };
  const scope_text = (token) => {
    const parts = [];
    if (token.scope && Number.isFinite(token.scope.version)) parts.push(translate("DCS_FEED_VERSION_N", { version: token.scope.version }));
    if (token.scope && (token.scope.from || token.scope.to)) parts.push(`${token.scope.from ? new Date(token.scope.from).toLocaleDateString(language) : "..."} - ${token.scope.to ? new Date(token.scope.to).toLocaleDateString(language) : "..."}`);
    return parts.length > 0 ? parts.join(", ") : translate("DCS_FEED_SCOPE_ALL");
  };

  const head = (
    <div className="min-w-0">
      <h2 className="text-base font-bold" style={{ color: TEXT, ...FONT }}>
        {translate("DCS_FEED_TITLE")}
      </h2>
      <p className="text-xs mt-1" style={{ color: MUTED, ...FONT }}>
        {translate("DCS_FEED_HINT")}
      </p>
    </div>
  );

  const body = (
        <div className="space-y-3">
          <button type="button" className="text-xs font-bold uppercase cursor-pointer bg-transparent border-0 p-0" style={{ color: PRIMARY, ...FONT }} onClick={() => setShowSteps((current) => !current)}>
            {translate(show_steps ? "DCS_FEED_HIDE_STEPS" : "DCS_FEED_SHOW_STEPS")}
          </button>
          {show_steps && (
            <ol className="text-xs space-y-1 pl-4" style={{ color: TEXT, listStyle: "decimal", ...FONT }}>
              <li>{translate("DCS_FEED_STEP_1")}</li>
              <li>{translate("DCS_FEED_STEP_2")}</li>
              <li>{translate("DCS_FEED_STEP_3")}</li>
              <li>{translate("DCS_FEED_STEP_4")}</li>
            </ol>
          )}

          {loading && (
            <p className="text-sm" style={{ color: MUTED, ...FONT }}>
              {translate("DCS_WAITING_GENERIC")}
            </p>
          )}
          {!loading && tokens.length === 0 && !creating && (
            <p className="text-sm" style={{ color: MUTED, ...FONT }}>
              {translate("DCS_FEED_NONE")}
            </p>
          )}
          {tokens.map((token) => (
            <div key={token.id} className="p-3 sm:p-4 space-y-2" style={{ backgroundColor: "#F7F9FB", opacity: token.expired ? 0.7 : 1 }}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-bold" style={{ color: TEXT, ...FONT }}>
                    {token.name}
                  </p>
                  <p className="text-xs" style={{ color: token.expired ? "#E74C3C" : MUTED, ...FONT }}>
                    {expiry_text(token)} - {scope_text(token)}
                  </p>
                  <p className="text-xs" style={{ color: MUTED, ...FONT }}>
                    {translate("DCS_FEED_USES", { count: token.uses || 0 })}
                    {token.last_used_at ? ` - ${translate("DCS_FEED_LAST_USED", { date: new Date(token.last_used_at).toLocaleString(language) })}` : ""}
                    {token.created_by_name ? ` - ${token.created_by_name}` : ""}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button type="button" className="text-xs font-bold uppercase cursor-pointer bg-transparent border-0" style={{ color: PRIMARY, ...FONT }} onClick={() => rotate(token)} disabled={saving}>
                    {translate("DCS_FEED_ROTATE")}
                  </button>
                  <button type="button" className="text-xs font-bold uppercase cursor-pointer bg-transparent border-0" style={{ color: "#E74C3C", ...FONT }} onClick={() => setRevoking(token)} disabled={saving}>
                    {translate("DCS_FEED_REVOKE")}
                  </button>
                </div>
              </div>
              <UrlRow label="CSV" url={data_feed_url(token.token, "csv")} onCopy={() => copy(data_feed_url(token.token, "csv"))} />
              <UrlRow label="JSON" url={data_feed_url(token.token, "json")} onCopy={() => copy(data_feed_url(token.token, "json"))} />
              <UrlRow label={translate("DCS_FEED_SCHEMA")} url={data_feed_url(token.token, "schema")} onCopy={() => copy(data_feed_url(token.token, "schema"))} />
            </div>
          ))}

          {creating && <DcsDataFeedForm versions={versions} saving={saving} onSubmit={create} onCancel={() => setCreating(false)} />}
          {!loading && !creating && (
            <DcsButtonPrimary onClick={() => setCreating(true)} disabled={saving}>
              {translate("DCS_FEED_NEW")}
            </DcsButtonPrimary>
          )}
        </div>
  );

  const confirm = revoking ? <DcsConfirmDialog titleKey="DCS_FEED_REVOKE_TITLE" messageKey="DCS_FEED_REVOKE_MESSAGE" confirming={saving} onConfirm={revoke} onCancel={() => setRevoking(null)} /> : null;

  if (asPage) {
    return (
      <div className="bg-white border-2 p-4 sm:p-5 space-y-4" style={{ borderColor: "#E0E0E0" }}>
        {head}
        {body}
        {confirm}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onClose} />
      <div className="relative bg-white w-full max-w-3xl h-full sm:h-auto sm:max-h-[92vh] flex flex-col cok-auth-card">
        <div className="p-4 sm:p-5 flex items-start justify-between gap-3">
          {head}
          <DcsButtonOutline onClick={onClose} disabled={saving}>
            {translate("DCS_BTN_CLOSE")}
          </DcsButtonOutline>
        </div>
        <div className="px-4 sm:px-5 pb-4 overflow-y-auto flex-1">{body}</div>
      </div>
      {confirm}
    </div>
  );
}
