import React, { useState, useEffect } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const PRIMARY = "#056daa";
const BORDER = "#E0E0E0";
const GRAY = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const RESEND_SECONDS = 180;

function format_countdown(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/**
 * The gate in front of every batch approval: no record is fetched until
 * the emailed code is exchanged for a session signature.
 */
export default function DcsBatchTokenDialog({ maskedEmail, busy, resending, onVerify, onResend, notice, sendFailed }) {
  const { translate } = useDcsLanguage();
  const [token_value, setTokenValue] = useState("");
  const [seconds_left, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (seconds_left <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds_left]);

  const handle_resend = async () => {
    await onResend();
    setSecondsLeft(RESEND_SECONDS);
    setTokenValue("");
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-sm bg-white border-2" style={{ borderColor: PRIMARY }}>
        <div className="px-5 py-4" style={{ backgroundColor: PRIMARY }}>
          <h2 className="text-white font-bold text-base uppercase" style={{ fontFamily: fontHeading, letterSpacing: 1 }}>
            {translate("DCS_BATCH_OTP_LABEL")}
          </h2>
        </div>
        <div className="p-5">
          <p className="text-sm mb-3" style={{ color: "#555555", fontFamily: fontHeading }}>
            {translate("DCS_BATCH_OTP_HINT", { email: maskedEmail || "" })}
          </p>

          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={token_value}
            onChange={(event) => setTokenValue(event.target.value.replace(/\D/g, ""))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && token_value.length === 6 && !busy) onVerify(token_value);
            }}
            placeholder="000000"
            className="border w-full px-3"
            style={{ borderColor: BORDER, height: 48, fontFamily: fontHeading, fontSize: 22, letterSpacing: 8, textAlign: "center" }}
          />

          {notice && (
            <p className="text-xs mt-2" style={{ color: "#C0564B", fontFamily: fontHeading }}>
              {notice}
            </p>
          )}

          <DcsButtonPrimary className="w-full mt-4" onClick={() => onVerify(token_value)} disabled={busy || token_value.length < 6}>
            <span className="inline-flex items-center justify-center gap-2">
              {busy && <SpiralLoader color="#FFFFFF" padded={false} size={16} />}
              {busy ? translate("DCS_BATCH_OTP_VERIFYING") : translate("DCS_BATCH_OTP_VERIFY")}
            </span>
          </DcsButtonPrimary>

          <div className="mt-3 text-center">
            {sendFailed ? (
              <button
                type="button"
                onClick={handle_resend}
                disabled={resending}
                className="dcs-retry-link text-xs disabled:opacity-60"
                style={{ fontFamily: fontHeading }}
              >
                {translate("DCS_MYAPPROVALS_RETRY")}
              </button>
            ) : seconds_left > 0 ? (
              <p className="text-xs" style={{ color: GRAY, fontFamily: fontHeading }}>
                {translate("DCS_BATCH_RESEND_IN", { time: format_countdown(seconds_left) })}
              </p>
            ) : (
              <button
                type="button"
                onClick={handle_resend}
                disabled={resending}
                className="dcs-retry-link text-xs disabled:opacity-60"
                style={{ fontFamily: fontHeading }}
              >
                {resending ? translate("DCS_BATCH_OTP_VERIFYING") : translate("DCS_BATCH_RESEND_TOKEN")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
