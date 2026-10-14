import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { portal_root } from "../util-dashboard/portalRoot.js";
import { request_delete_code, confirm_delete_code, resend_delete_code } from "../services/submissionsService.js";
import DcsCenterOverlay from "./DcsCenterOverlay.jsx";
import DcsButtonOutlineDanger from "./DcsButtonOutlineDanger.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const FONT = "'Montserrat', sans-serif";
const DANGER = "#E74C3C";
const TEXT = "#333333";
const MUTED = "#555555";
const CODE_LENGTH = 6;

function confirm_failure_key(error) {
  const status = error && error.status_code;
  if (status === 401) return "DCS_TABLE_DELETE_CODE_WRONG";
  if (status === 410) return "DCS_TABLE_DELETE_CODE_EXPIRED";
  if (status === 429) return "DCS_TABLE_DELETE_CODE_TOO_MANY";
  return "";
}

export default function DcsDeleteCodeDialog({ submissionIds, onClose, onDeleted }) {
  const { translate } = useDcsLanguage();
  const [request, setRequest] = useState(null);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [resending, setResending] = useState(false);
  const [error_text, setErrorText] = useState("");
  const [locked, setLocked] = useState(false);

  const busy = sending || confirming || resending;
  const generic = (error) => (error && error.message) || translate("DCS_ERROR_GENERIC");

  useEffect(() => {
    let is_mounted = true;
    request_delete_code(submissionIds)
      .then((response) => {
        if (is_mounted) setRequest(response.data || null);
      })
      .catch((error) => {
        if (!is_mounted) return;
        setLocked(true);
        setErrorText(generic(error));
      })
      .finally(() => {
        if (is_mounted) setSending(false);
      });
    return () => {
      is_mounted = false;
    };
  }, []);

  useEffect(() => {
    const on_key = (event) => {
      if (event.key !== "Escape" || busy) return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", on_key, true);
    return () => document.removeEventListener("keydown", on_key, true);
  }, [busy, onClose]);

  const handle_close = () => {
    if (!busy) onClose();
  };

  const handle_confirm = async (event) => {
    if (event) event.preventDefault();
    if (!request || locked || busy || code.length < CODE_LENGTH) return;
    setConfirming(true);
    setErrorText("");
    try {
      const response = await confirm_delete_code(request.request_id, code);
      onDeleted((response.data && response.data.deleted) || 0);
    } catch (error) {
      const key = confirm_failure_key(error);
      const status = error && error.status_code;
      setErrorText(key ? translate(key) : generic(error));
      if (status === 410 || status === 429) setLocked(true);
      setCode("");
      setConfirming(false);
    }
  };

  const handle_resend = async () => {
    if (!request || locked || busy) return;
    setResending(true);
    setErrorText("");
    try {
      const response = await resend_delete_code(request.request_id);
      if (response.data) setRequest(response.data);
      setCode("");
    } catch (error) {
      const status = error && error.status_code;
      setErrorText(status === 410 ? translate("DCS_TABLE_DELETE_CODE_EXPIRED") : generic(error));
      if (status === 410) setLocked(true);
    } finally {
      setResending(false);
    }
  };

  const can_type = !!request && !locked;

  return createPortal(
    <DcsCenterOverlay
      title={translate("DCS_TABLE_DELETE_CODE_TITLE")}
      onClose={handle_close}
      onBackdrop={handle_close}
      busy={busy}
      accent={DANGER}
      maxWidth={420}
    >
      <form onSubmit={handle_confirm}>
        <p className="text-sm mb-3" style={{ color: MUTED, fontFamily: FONT }}>
          {translate("DCS_TABLE_DELETE_SELECTED_WARNING")}
        </p>

        {sending ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: MUTED, fontFamily: FONT }}>
            <SpiralLoader padded={false} size={18} />
            <span>{translate("DCS_TABLE_DELETE_CODE_SENDING")}</span>
          </div>
        ) : null}

        {request ? (
          <p className="text-sm mb-4" style={{ color: TEXT, fontFamily: FONT }}>
            {translate("DCS_TABLE_DELETE_CODE_SENT", { email: request.email_masked || "" })}
          </p>
        ) : null}

        {can_type ? (
          <>
            <label className="cok-auth-label" htmlFor="dcs-delete-code">
              {translate("DCS_TABLE_DELETE_CODE_LABEL")}
            </label>
            <input
              id="dcs-delete-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              autoFocus
              value={code}
              disabled={busy}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
              placeholder="000000"
              className="cok-auth-input"
              style={{ paddingLeft: 12, textAlign: "center", letterSpacing: 8, fontSize: 20 }}
            />
          </>
        ) : null}

        {error_text ? (
          <p className="text-xs mt-2" style={{ color: DANGER, fontFamily: FONT }}>
            {error_text}
          </p>
        ) : null}

        {can_type ? (
          <div className="mt-4">
            {confirming ? (
              <SpiralLoader padded={false} color={DANGER} />
            ) : (
              <DcsButtonOutlineDanger type="submit" className="w-full" disabled={busy || code.length < CODE_LENGTH}>
                {translate("DCS_TABLE_DELETE_CODE_BTN")}
              </DcsButtonOutlineDanger>
            )}
            <div className="mt-3 text-center">
              {resending ? (
                <SpiralLoader padded={false} size={16} />
              ) : (
                <button type="button" onClick={handle_resend} disabled={busy} className="dcs-retry-link text-xs disabled:opacity-60" style={{ fontFamily: FONT }}>
                  {translate("DCS_TABLE_DELETE_CODE_RESEND")}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </form>
    </DcsCenterOverlay>,
    portal_root(),
  );
}
