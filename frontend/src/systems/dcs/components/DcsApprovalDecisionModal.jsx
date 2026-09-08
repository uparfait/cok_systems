import React, { useState, useEffect, useMemo, useRef } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { submit_approval_decision, upload_approval_file } from "../services/approvalsService.js";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";
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

// One submitted answer rendered read-only, same rules as the approval pages.
function AnswerValue({ value }) {
  const { translate } = useDcsLanguage();
  if (value === null || value === undefined || value === "") return <span style={{ color: GRAY }}>-</span>;
  if (Array.isArray(value)) return <span>{value.join(", ")}</span>;
  if (typeof value === "object") {
    if (value.url) {
      return (
        <a href={value.url} target="_blank" rel="noreferrer" className="underline" style={{ color: PRIMARY }}>
          {value.name || translate("DCS_APPROVAL_FILE_LINK")}
        </a>
      );
    }
    return <span>{value.name || JSON.stringify(value)}</span>;
  }
  return <span>{String(value)}</span>;
}

/**
 * Popup for deciding one record in place: shows everything the submitter
 * entered, then takes the comment (and, for approve, the signature) and
 * records the decision - no navigation away from the approvals page.
 */
export default function DcsApprovalDecisionModal({ record, form, decision, onClose, onDone }) {
  const { translate, language } = useDcsLanguage();
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

  // Only fields the submitter actually answered, in schema order.
  const answered_fields = useMemo(() => {
    const schema_fields = (form && form.schema && form.schema.fields) || [];
    return flatten_fields(schema_fields).filter(
      (field) => field.type !== "group" && record.data && Object.prototype.hasOwnProperty.call(record.data, field.id),
    );
  }, [form, record]);

  const label_of = (field) => get_field_text(field.label, language) || field.id;

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
      <div className="w-full max-w-lg bg-white max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 flex items-center justify-between gap-3" style={{ backgroundColor: accent }}>
          <div className="min-w-0">
            <h2 className="text-white font-bold text-base truncate" style={{ fontFamily: fontHeading }}>
              {translate(is_approve ? "DCS_APPROVAL_BTN_APPROVE" : "DCS_APPROVAL_BTN_REJECT")} - {form_name}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.85)", fontFamily: fontHeading }}>
              {translate("DCS_MYAPPROVALS_COL_SUBMITTED")}: {record.submitted_at ? new Date(record.submitted_at).toLocaleString() : "-"}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={acting} className="cursor-pointer text-white text-xl leading-none px-1" aria-label={translate("DCS_MYAPPROVALS_CANCEL")}>
            &times;
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {/* Everything the submitter entered, read-only */}
          <div className="border" style={{ borderColor: BORDER }}>
            {answered_fields.length === 0 && <p className="p-3 text-sm" style={{ color: GRAY }}>-</p>}
            {answered_fields.map((field, index) => (
              <div key={field.id} className="px-3 py-2 flex flex-col gap-0.5" style={{ borderTop: index === 0 ? "none" : `1px solid ${BORDER}`, backgroundColor: index % 2 === 0 ? "#FFFFFF" : NEUTRAL_LIGHT }}>
                <span className="text-xs font-semibold uppercase" style={{ color: GRAY, fontFamily: fontHeading, letterSpacing: 0.5 }}>{label_of(field)}</span>
                <span className="text-sm" style={{ color: NEUTRAL_DARK }}><AnswerValue value={record.data[field.id]} /></span>
              </div>
            ))}
          </div>

          <label className="block text-xs font-semibold uppercase mt-4 mb-1" style={{ color: GRAY, fontFamily: fontHeading, letterSpacing: 0.5 }}>
            {translate("DCS_APPROVAL_COMMENT_LABEL")}
          </label>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            className="w-full text-sm p-2 border"
            style={{ borderColor: BORDER, fontFamily: fontHeading, outline: "none", resize: "vertical" }}
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
                    onChange={(event) => setCertificateFile(event.target.files && event.target.files[0] ? event.target.files[0] : null)}
                    className="text-sm"
                    style={{ fontFamily: fontHeading }}
                  />
                  <p className="text-xs mt-1" style={{ color: GRAY, fontFamily: fontHeading }}>{translate("DCS_APPROVAL_CERT_HINT")}</p>
                </div>
              )}
            </>
          )}

          <div className="flex gap-3 mt-5 flex-wrap">
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
    </div>
  );
}
