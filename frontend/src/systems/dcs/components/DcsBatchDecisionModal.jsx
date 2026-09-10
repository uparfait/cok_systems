import React, { useState, useEffect, useRef } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { upload_batch_approval_file } from "../services/approvalsService.js";
import { new_idempotency_key, is_session_error } from "../services/batchApprovalSession.js";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";
import DcsButtonOutlineDanger from "./DcsButtonOutlineDanger.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const PRIMARY = "#056daa";
const SOFT_RED = "#C0564B";
const GRAY = "#9E9E9E";
const BORDER = "#E0E0E0";
const NEUTRAL_DARK = "#333333";
const NEUTRAL_LIGHT = "#F7F9FB";
const fontHeading = "'Montserrat', sans-serif";
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 160;
const CERTIFICATE_ACCEPT = ".pdf,.p12,.pfx,.cer,.crt,.pem,.der,.sig,.png,.jpg,.jpeg";

/**
 * Deciding on the public batch link: the same comment plus signature
 * popup the signed-in approver dashboard uses, serving both a single
 * record and the whole batch. Approving demands a signature exactly as
 * it does there; the idempotency key is minted once per attempt and
 * reused on retry, so a repeated click can never decide twice.
 */
export default function DcsBatchDecisionModal({ token, formName, recordCount, decision, onClose, onSubmit, onDone, onSessionLost }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();

  const [comment, setComment] = useState("");
  const [sign_method, setSignMethod] = useState("drawn");
  const [certificate_file, setCertificateFile] = useState(null);
  const [has_drawn, setHasDrawn] = useState(false);
  const [acting, setActing] = useState(false);
  const canvas_ref = useRef(null);
  const is_drawing_ref = useRef(false);
  const key_ref = useRef(new_idempotency_key());

  const is_approve = decision === "approve";
  const accent = is_approve ? PRIMARY : SOFT_RED;

  const get_canvas_position = (event) => {
    const canvas = canvas_ref.current;
    const rect = canvas.getBoundingClientRect();
    const point = event.touches ? event.touches[0] : event;
    return { x: ((point.clientX - rect.left) * canvas.width) / rect.width, y: ((point.clientY - rect.top) * canvas.height) / rect.height };
  };
  const start_drawing = (event) => {
    is_drawing_ref.current = true;
    const context = canvas_ref.current.getContext("2d");
    const position = get_canvas_position(event);
    context.beginPath();
    context.moveTo(position.x, position.y);
  };
  const draw = (event) => {
    if (!is_drawing_ref.current) return;
    const context = canvas_ref.current.getContext("2d");
    const position = get_canvas_position(event);
    context.lineTo(position.x, position.y);
    context.strokeStyle = NEUTRAL_DARK;
    context.lineWidth = 2;
    context.lineCap = "round";
    context.stroke();
    setHasDrawn(true);
  };
  const stop_drawing = () => {
    is_drawing_ref.current = false;
  };
  const clear_canvas = () => {
    const canvas = canvas_ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  useEffect(() => {
    if (sign_method === "drawn") clear_canvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sign_method]);

  const export_drawn_signature = () =>
    new Promise((resolve, reject) => {
      canvas_ref.current.toBlob((blob) => {
        if (!blob) {
          reject(new Error(translate("DCS_ERROR_GENERIC")));
          return;
        }
        resolve(new File([blob], "signature.png", { type: "image/png" }));
      }, "image/png");
    });

  // Approve needs an uploaded signature, reject records the decision directly.
  const handle_confirm = async () => {
    setActing(true);
    try {
      let signature = null;
      if (is_approve) {
        let file = null;
        if (sign_method === "drawn") {
          if (!has_drawn) {
            showError(translate("DCS_APPROVAL_SIGNATURE_REQUIRED_HINT"));
            setActing(false);
            return;
          }
          file = await export_drawn_signature();
        } else {
          if (!certificate_file) {
            showError(translate("DCS_APPROVAL_SIGNATURE_REQUIRED_HINT"));
            setActing(false);
            return;
          }
          file = certificate_file;
        }
        const uploaded = await upload_batch_approval_file(token, file);
        signature = { kind: sign_method, file: uploaded };
      }

      const response = await onSubmit(comment.trim() || null, key_ref.current, signature);
      showSuccess(
        (response && response.message) ||
          translate(is_approve ? "DCS_APPROVAL_APPROVED_DONE" : "DCS_APPROVAL_REJECTED_DONE"),
      );
      onDone((response && response.data) || {});
    } catch (error) {
      if (is_session_error(error)) {
        onSessionLost(error.message || "");
        showError(error.message || translate("DCS_ERROR_GENERIC"));
        return;
      }
      showError((error && error.message) || translate("DCS_ERROR_GENERIC"));
      setActing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
      <div className="w-full max-w-xl bg-white max-h-[90vh] flex flex-col border-2" style={{ borderColor: accent }}>
        <div className="px-5 py-4 shrink-0" style={{ backgroundColor: accent }}>
          <h2 className="text-white font-bold text-base" style={{ fontFamily: fontHeading }}>
            {translate(is_approve ? "DCS_APPROVAL_BTN_APPROVE" : "DCS_APPROVAL_BTN_REJECT")}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.85)", fontFamily: fontHeading }}>
            {formName}
            {recordCount > 1 ? ` - ${translate("DCS_SCHED_RECORDS", { count: recordCount })}` : ""}
          </p>
        </div>

        <div className="p-5 overflow-y-auto">
          <label className="block text-xs font-semibold uppercase mb-1" style={{ color: GRAY, fontFamily: fontHeading, letterSpacing: 0.5 }}>
            {translate("DCS_APPROVAL_COMMENT_LABEL")}
          </label>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            disabled={acting}
            className="w-full text-sm p-2 border"
            style={{ borderColor: BORDER, fontFamily: fontHeading, outline: "none", resize: "vertical", backgroundColor: NEUTRAL_LIGHT }}
          />

          {is_approve && (
            <>
              <p className="mt-4 mb-2 text-xs font-semibold uppercase" style={{ color: GRAY, fontFamily: fontHeading, letterSpacing: 0.5 }}>
                {translate("DCS_APPROVAL_SIGN_METHOD_LABEL")}
              </p>
              <div className="flex gap-2 flex-wrap mb-3">
                {["drawn", "certificate"].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setSignMethod(method)}
                    disabled={acting}
                    className="cursor-pointer text-xs font-semibold uppercase px-3 py-2 disabled:opacity-60"
                    style={{
                      fontFamily: fontHeading,
                      letterSpacing: 0.5,
                      border: `1px solid ${PRIMARY}`,
                      backgroundColor: sign_method === method ? PRIMARY : "transparent",
                      color: sign_method === method ? "#FFFFFF" : PRIMARY,
                    }}
                  >
                    {translate(method === "drawn" ? "DCS_APPROVAL_SIGN_DRAW" : "DCS_APPROVAL_SIGN_CERTIFICATE")}
                  </button>
                ))}
              </div>

              {sign_method === "drawn" && (
                <div>
                  <canvas
                    ref={canvas_ref}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    className="w-full border"
                    style={{ borderColor: BORDER, touchAction: "none", display: "block", backgroundColor: "#FFFFFF" }}
                    onMouseDown={start_drawing}
                    onMouseMove={draw}
                    onMouseUp={stop_drawing}
                    onMouseLeave={stop_drawing}
                    onTouchStart={start_drawing}
                    onTouchMove={draw}
                    onTouchEnd={stop_drawing}
                  />
                  <div className="mt-2">
                    <DcsButtonOutline onClick={clear_canvas} disabled={acting}>
                      {translate("DCS_RENDERER_SIGNATURE_CLEAR")}
                    </DcsButtonOutline>
                  </div>
                </div>
              )}

              {sign_method === "certificate" && (
                <div>
                  <input
                    type="file"
                    accept={CERTIFICATE_ACCEPT}
                    disabled={acting}
                    onChange={(event) => setCertificateFile(event.target.files && event.target.files[0] ? event.target.files[0] : null)}
                    className="text-sm"
                    style={{ fontFamily: fontHeading }}
                  />
                  <p className="text-xs mt-1" style={{ color: GRAY, fontFamily: fontHeading }}>{translate("DCS_APPROVAL_CERT_HINT")}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3.5 flex gap-3 shrink-0 border-t" style={{ borderColor: BORDER, backgroundColor: NEUTRAL_LIGHT }}>
          <DcsButtonOutline onClick={onClose} disabled={acting} className="flex-1">
            {translate("DCS_MYAPPROVALS_CANCEL")}
          </DcsButtonOutline>
          {is_approve ? (
            <DcsButtonPrimary onClick={handle_confirm} disabled={acting} className="flex-1">
              <span className="inline-flex items-center justify-center gap-2">
                {acting && <SpiralLoader color="#FFFFFF" padded={false} size={16} />}
                {translate("DCS_APPROVAL_BTN_APPROVE")}
              </span>
            </DcsButtonPrimary>
          ) : (
            <DcsButtonOutlineDanger onClick={handle_confirm} disabled={acting} className="flex-1">
              <span className="inline-flex items-center justify-center gap-2">
                {acting && <SpiralLoader color={SOFT_RED} padded={false} size={16} />}
                {translate("DCS_APPROVAL_BTN_REJECT")}
              </span>
            </DcsButtonOutlineDanger>
          )}
        </div>
      </div>
    </div>
  );
}
