import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { DcsLanguageProvider, useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_approval, submit_approval_decision, upload_approval_file, build_approval_link } from "../services/approvalsService.js";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";
import DcsFormLoadingSpinner from "../components/DcsFormLoadingSpinner.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";
import DcsErrorBoundary from "../components/DcsErrorBoundary.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsButtonOutlineDanger from "../components/DcsButtonOutlineDanger.jsx";

const STATUS_COLORS = { pending: "#F39C12", approved: "#4CAF50", rejected: "#E74C3C", skipped: "#9E9E9E" };
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 160;
const CERTIFICATE_ACCEPT = ".pdf,.p12,.pfx,.cer,.crt,.pem,.der,.sig,.png,.jpg,.jpeg";

// One submitted answer displayed read-only; media answers render as links, never re-fetched blobs.
function AnswerValue({ value }) {
  const { translate } = useDcsLanguage();
  if (value === null || value === undefined || value === "") return <span style={{ color: "#9E9E9E" }}>-</span>;
  if (Array.isArray(value)) return <span>{value.join(", ")}</span>;
  if (typeof value === "object") {
    if (value.url) {
      return (
        <a href={value.url} target="_blank" rel="noreferrer" className="underline" style={{ color: "#056daa" }}>
          {value.name || translate("DCS_APPROVAL_FILE_LINK")}
        </a>
      );
    }
    return <span>{value.name || JSON.stringify(value)}</span>;
  }
  return <span>{String(value)}</span>;
}

// A small colored chip for a step or overall status.
function StatusChip({ status }) {
  const { translate } = useDcsLanguage();
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 uppercase"
      style={{ color: "#FFFFFF", backgroundColor: STATUS_COLORS[status] || "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}
    >
      {translate(`DCS_APPROVAL_STATUS_${status.toUpperCase()}`)}
    </span>
  );
}

// Public approver page behind /dcs-approval/:token - the token is the approver's whole credential.
function ApprovalPageContent() {
  const { token } = useParams();
  const { translate, language } = useDcsLanguage();
  const { showSuccess, showError } = useToast();

  const [approval, setApproval] = useState(null);
  const [load_state, setLoadState] = useState("loading");
  const [comment, setComment] = useState("");
  const [sign_method, setSignMethod] = useState("drawn");
  const [certificate_file, setCertificateFile] = useState(null);
  const [has_drawn, setHasDrawn] = useState(false);
  const [acting, setActing] = useState(false);
  const [upload_percent, setUploadPercent] = useState(null);
  const [decision_result, setDecisionResult] = useState(null);
  const canvas_ref = useRef(null);
  const is_drawing_ref = useRef(false);

  useEffect(() => {
    let is_mounted = true;
    get_approval(token)
      .then((response) => {
        if (!is_mounted) return;
        setApproval(response.data);
        setLoadState("ready");
      })
      .catch(() => {
        if (is_mounted) setLoadState("not_found");
      });
    return () => {
      is_mounted = false;
    };
  }, [token]);

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
    context.strokeStyle = "#333333";
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
    if (approval && approval.can_act && !decision_result) clear_canvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approval, sign_method, decision_result]);

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

  const handle_decide = async (decision) => {
    setActing(true);
    try {
      let signature = null;
      if (decision === "approve") {
        let file = null;
        if (sign_method === "drawn") {
          if (!has_drawn) {
            showError(translate("DCS_APPROVAL_SIGNATURE_REQUIRED_HINT"));
            return;
          }
          file = await export_drawn_signature();
        } else {
          if (!certificate_file) {
            showError(translate("DCS_APPROVAL_SIGNATURE_REQUIRED_HINT"));
            return;
          }
          file = certificate_file;
        }
        const uploaded = await upload_approval_file(token, file, setUploadPercent);
        signature = { kind: sign_method, file: uploaded };
      }

      const response = await submit_approval_decision(token, decision, comment.trim() || null, signature);
      setDecisionResult(response.data);
      setApproval((previous) =>
        Object.assign({}, previous, {
          can_act: false,
          overall_status: response.data.overall_status,
          approver: Object.assign({}, previous.approver, { status: response.data.decision }),
          trail: response.data.trail,
        }),
      );
      showSuccess(response.message || translate("DCS_APPROVAL_DECISION_DONE"));
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setActing(false);
      setUploadPercent(null);
    }
  };

  const copy_link = (link) => {
    window.navigator.clipboard.writeText(link);
    showSuccess(translate("DCS_TOAST_LINK_COPIED"));
  };

  if (load_state === "loading") return <DcsFormLoadingSpinner />;
  if (load_state === "not_found") return <DcsEmptyState messageKey="DCS_APPROVAL_NOT_FOUND" />;

  const answered_fields = flatten_fields(approval.schema.fields).filter(
    (field) => approval.data && Object.prototype.hasOwnProperty.call(approval.data, field.id),
  );
  const next_links = (decision_result && decision_result.next_links) || [];

  const waiting_reason = () => {
    if (approval.approver.status !== "pending") return translate("DCS_APPROVAL_ALREADY_ACTED");
    if (approval.overall_status === "pending") return translate("DCS_APPROVAL_NOT_TURN");
    return null;
  };

  return (
    <div className="min-h-screen p-3 min-[700px]:p-6 flex flex-col items-center" style={{ backgroundColor: "#F7F9FB" }}>
      <div className="w-full min-[700px]:max-w-[700px] bg-white p-4 sm:p-6 border-0 min-[700px]:border-[5px] min-[700px]:rounded-[5px]" style={{ borderColor: "rgba(5,109,170,0.35)", marginTop: 12, marginBottom: 24 }}>
        <p className="text-xs font-semibold uppercase" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: 0.5 }}>
          {translate("DCS_APPROVAL_PAGE_TITLE")}
        </p>
        <div className="flex items-center justify-between gap-3 flex-wrap mt-1">
          <h1 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 22, color: "#056daa", margin: 0 }}>
            {approval.form_name}
          </h1>
          <StatusChip status={approval.overall_status} />
        </div>
        <p className="mt-2 text-sm" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
          {translate("DCS_APPROVAL_YOU_ARE", { name: approval.approver.name, role: approval.approver.role })}
        </p>
        {approval.submitted_at && (
          <p className="text-xs mt-1" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_APPROVAL_SUBMITTED_AT", { date: new Date(approval.submitted_at).toLocaleString() })}
          </p>
        )}

        {approval.overall_status === "approved" && (
          <p className="mt-3 text-sm px-3 py-2" style={{ backgroundColor: "rgba(76,175,80,0.12)", color: "#4CAF50", fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_APPROVAL_FINALIZED_APPROVED")}
          </p>
        )}
        {approval.overall_status === "rejected" && (
          <p className="mt-3 text-sm px-3 py-2" style={{ backgroundColor: "rgba(231,76,60,0.1)", color: "#E74C3C", fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_APPROVAL_FINALIZED_REJECTED")}
          </p>
        )}

        <h2 className="mt-6 mb-2" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 15, color: "#333333" }}>
          {translate("DCS_APPROVAL_DATA_TITLE")}
        </h2>
        <div className="border" style={{ borderColor: "#E0E0E0" }}>
          {answered_fields.length === 0 && (
            <p className="p-3 text-sm" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>-</p>
          )}
          {answered_fields.map((field, index) => (
            <div key={field.id} className="p-3 flex flex-col gap-1" style={{ borderTop: index === 0 ? "none" : "1px solid #E0E0E0" }}>
              <span className="text-xs font-semibold uppercase" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: 0.5 }}>
                {get_field_text(field.label, language) || field.id}
              </span>
              <span className="text-sm" style={{ color: "#333333" }}>
                <AnswerValue value={approval.data[field.id]} />
              </span>
            </div>
          ))}
        </div>

        <h2 className="mt-6 mb-2" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 15, color: "#333333" }}>
          {translate("DCS_APPROVAL_TRAIL_TITLE")}
        </h2>
        <div className="space-y-2">
          {approval.trail.map((step) => (
            <div key={step.level} className="border p-3 flex items-start justify-between gap-3 flex-wrap" style={{ borderColor: "#E0E0E0" }}>
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
                  {translate("DCS_APPROVAL_LEVEL_LABEL", { number: step.level + 1 })} - {step.name}
                  <span className="font-normal" style={{ color: "#9E9E9E" }}> ({step.role})</span>
                </p>
                {step.comment && (
                  <p className="text-sm mt-1" style={{ color: "#555555" }}>&ldquo;{step.comment}&rdquo;</p>
                )}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {step.acted_at && (
                    <span className="text-xs" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
                      {new Date(step.acted_at).toLocaleString()}
                    </span>
                  )}
                  {step.signature && step.signature.file && step.signature.file.url && (
                    <a href={step.signature.file.url} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif" }}>
                      {translate(step.signature.kind === "certificate" ? "DCS_APPROVAL_SIGN_CERTIFICATE" : "DCS_APPROVAL_SIGN_DRAW")}
                    </a>
                  )}
                </div>
              </div>
              <StatusChip status={step.status} />
            </div>
          ))}
        </div>

        {next_links.length > 0 && (
          <div className="mt-4 border-2 p-3" style={{ borderColor: "#056daa" }}>
            {next_links.map((link_info) => {
              const approval_link = build_approval_link(link_info.token);
              return (
                <div key={link_info.token} className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
                      {translate("DCS_APPROVAL_NEXT_LINK", { name: link_info.name, role: link_info.role })}
                    </p>
                    <p className="truncate text-sm" style={{ color: "#056daa" }} title={approval_link}>{approval_link}</p>
                  </div>
                  <DcsButtonOutline onClick={() => copy_link(approval_link)}>{translate("DCS_FORM_COPY_LINK")}</DcsButtonOutline>
                </div>
              );
            })}
          </div>
        )}

        {approval.can_act && !decision_result && (
          <div className="mt-6 border-t pt-4" style={{ borderColor: "#E0E0E0" }}>
            <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: 0.5 }}>
              {translate("DCS_APPROVAL_COMMENT_LABEL")}
            </label>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              className="w-full text-sm p-2 border"
              style={{ borderColor: "#E0E0E0", fontFamily: "'Montserrat', sans-serif", outline: "none", resize: "vertical" }}
            />

            <p className="mt-4 mb-2 text-xs font-semibold uppercase" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: 0.5 }}>
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
                    fontFamily: "'Montserrat', sans-serif",
                    letterSpacing: 0.5,
                    border: "1px solid #056daa",
                    backgroundColor: sign_method === method ? "#056daa" : "transparent",
                    color: sign_method === method ? "#FFFFFF" : "#056daa",
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
                  style={{ borderColor: "#E0E0E0", touchAction: "none", display: "block", backgroundColor: "#FFFFFF" }}
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
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                />
                <p className="text-xs mt-1" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}>
                  {translate("DCS_APPROVAL_CERT_HINT")}
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-4 flex-wrap">
              <DcsButtonPrimary onClick={() => handle_decide("approve")} disabled={acting} className="flex-1">
                {upload_percent !== null
                  ? translate("DCS_UPLOADING_PERCENT", { percent: upload_percent })
                  : translate("DCS_APPROVAL_BTN_APPROVE")}
              </DcsButtonPrimary>
              <DcsButtonOutlineDanger onClick={() => handle_decide("reject")} disabled={acting} className="flex-1">
                {translate("DCS_APPROVAL_BTN_REJECT")}
              </DcsButtonOutlineDanger>
            </div>
          </div>
        )}

        {!approval.can_act && !decision_result && approval.overall_status === "pending" && waiting_reason() && (
          <p className="mt-4 text-sm px-3 py-2" style={{ backgroundColor: "rgba(243,156,18,0.12)", color: "#F39C12", fontFamily: "'Montserrat', sans-serif" }}>
            {waiting_reason()}
          </p>
        )}

        {decision_result && (
          <p
            className="mt-4 text-sm px-3 py-2"
            style={{
              backgroundColor: decision_result.decision === "approved" ? "rgba(76,175,80,0.12)" : "rgba(231,76,60,0.1)",
              color: decision_result.decision === "approved" ? "#4CAF50" : "#E74C3C",
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            {translate(decision_result.decision === "approved" ? "DCS_APPROVAL_DONE_APPROVED" : "DCS_APPROVAL_DONE_REJECTED")}
          </p>
        )}
      </div>
    </div>
  );
}

// Standalone public route, wrapped with its own language provider like PublicFormPage.
export default function ApprovalPage() {
  return (
    <DcsErrorBoundary>
      <DcsLanguageProvider>
        <ApprovalPageContent />
      </DcsLanguageProvider>
    </DcsErrorBoundary>
  );
}
