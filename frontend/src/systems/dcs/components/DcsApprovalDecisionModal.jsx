import React, { useState, useEffect, useRef } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { submit_approval_decision, upload_approval_file } from "../services/approvalsService.js";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";
import DcsButtonOutline from "./DcsButtonOutline.jsx";
import DcsButtonOutlineDanger from "./DcsButtonOutlineDanger.jsx";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";
const GRAY = "#9E9E9E";
const NEUTRAL_DARK = "#333333";
const NEUTRAL_LIGHT = "#F7F9FB";
const BORDER = "#E0E0E0";
const fontHeading = "'Montserrat', sans-serif";
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 160;
const CERTIFICATE_ACCEPT = ".pdf,.p12,.pfx,.cer,.crt,.pem,.der,.sig,.png,.jpg,.jpeg";

/**
 * Popup for deciding one record in place: takes the comment (and, for approve,
 * the signature) and records the decision - no navigation away from the
 * approvals page. The submitted data is not repeated here; the approver has
 * already reviewed it in the table or form view.
 */
export default function DcsApprovalDecisionModal({ record, form, decision, onClose, onDone }) {
  const { translate } = useDcsLanguage();
  const { showSuccess, showError } = useToast();

  const [comment, setComment] = useState("");
  const [sign_method, setSignMethod] = useState("drawn");
  const [certificate_file, setCertificateFile] = useState(null);
  const [has_drawn, setHasDrawn] = useState(false);
  const [acting, setActing] = useState(false);
  const canvas_ref = useRef(null);
  const is_drawing_ref = useRef(false);

  const is_approve = decision === "approve";
  const accent = is_approve ? PRIMARY : DANGER;
  const form_name = (form && form.form_name) || record.form_key;

  // --- signature canvas (same behavior as the single approval page) ---
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
    if (is_approve && sign_method === "drawn") clear_canvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sign_method]);

  const export_drawn_signature = () =>
    new Promise((resolve, reject) => {
      canvas_ref.current.toBlob((blob) => {
        if (!blob) {
          reject(new Error("signature_export_failed"));
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
        const uploaded = await upload_approval_file(record.step.token, file, null);
        signature = { kind: sign_method, file: uploaded };
      }
      const response = await submit_approval_decision(record.step.token, decision, comment.trim() || null, signature);
      showSuccess((response && response.message) || translate("DCS_APPROVAL_DECISION_DONE"));
      onDone();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
      setActing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
      <div className="w-full max-w-xl bg-white max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header - action, form and submission date at a glance */}
        <div className="px-5 py-4 flex items-center gap-3 shrink-0" style={{ backgroundColor: accent }}>
          <div
            className="w-10 h-10 flex items-center justify-center text-lg font-extrabold shrink-0"
            style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "#FFFFFF", borderRadius: "50%" }}
            aria-hidden="true"
          >
            {is_approve ? "✓" : "✕"}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-white font-bold text-base leading-tight truncate" style={{ fontFamily: fontHeading }}>
              {translate(is_approve ? "DCS_APPROVAL_BTN_APPROVE" : "DCS_APPROVAL_BTN_REJECT")}
            </h2>
            <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.85)", fontFamily: fontHeading }}>
              {form_name}
              {record.submitted_at ? ` · ${translate("DCS_APPROVAL_SUBMITTED_AT", { date: new Date(record.submitted_at).toLocaleString() })}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={acting}
            className="cursor-pointer text-white text-lg leading-none w-8 h-8 flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(255,255,255,0.14)", borderRadius: "50%" }}
            aria-label={translate("DCS_MYAPPROVALS_CANCEL")}
          >
            &times;
          </button>
        </div>

        {/* Scrollable body - comment and signature (the data was already reviewed in the list) */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          <label className="block text-xs font-bold uppercase mb-1.5" style={{ color: accent, fontFamily: fontHeading, letterSpacing: 0.8 }}>
            {translate("DCS_APPROVAL_COMMENT_LABEL")}
          </label>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            className="w-full text-sm p-2.5 border"
            style={{ borderColor: BORDER, fontFamily: fontHeading, outline: "none", resize: "vertical", backgroundColor: NEUTRAL_LIGHT }}
          />

          {is_approve && (
            <>
              <p className="mt-5 mb-2 text-xs font-bold uppercase" style={{ color: accent, fontFamily: fontHeading, letterSpacing: 0.8 }}>
                {translate("DCS_APPROVAL_SIGN_METHOD_LABEL")}
              </p>
              <div className="flex gap-2 flex-wrap mb-3">
                {["drawn", "certificate"].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setSignMethod(method)}
                    className="cursor-pointer text-xs font-semibold uppercase px-3 py-2"
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
                <div className="p-3 border" style={{ borderColor: BORDER, backgroundColor: NEUTRAL_LIGHT }}>
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
                <div className="p-3 border" style={{ borderColor: BORDER, backgroundColor: NEUTRAL_LIGHT }}>
                  <input
                    type="file"
                    accept={CERTIFICATE_ACCEPT}
                    onChange={(event) => setCertificateFile(event.target.files && event.target.files[0] ? event.target.files[0] : null)}
                    className="text-sm w-full"
                    style={{ fontFamily: fontHeading }}
                  />
                  <p className="text-xs mt-1.5" style={{ color: GRAY, fontFamily: fontHeading }}>{translate("DCS_APPROVAL_CERT_HINT")}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Fixed action bar - always reachable without scrolling */}
        <div className="px-5 py-3.5 flex gap-3 shrink-0 border-t" style={{ borderColor: BORDER, backgroundColor: NEUTRAL_LIGHT }}>
          <DcsButtonOutline onClick={onClose} disabled={acting} className="flex-1">
            {translate("DCS_MYAPPROVALS_CANCEL")}
          </DcsButtonOutline>
          {is_approve ? (
            <DcsButtonPrimary onClick={handle_confirm} disabled={acting} className="flex-1">
              {translate("DCS_APPROVAL_BTN_APPROVE")}
            </DcsButtonPrimary>
          ) : (
            <DcsButtonOutlineDanger onClick={handle_confirm} disabled={acting} className="flex-1">
              {translate("DCS_APPROVAL_BTN_REJECT")}
            </DcsButtonOutlineDanger>
          )}
        </div>
      </div>
    </div>
  );
}
