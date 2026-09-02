import React, { useState, useEffect, useMemo, useRef } from "react";
import { DcsLanguageProvider, useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useAuth } from "../../../core/contexts/AuthContext";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_my_approvals, submit_approval_decision, upload_approval_file, build_approval_link } from "../services/approvalsService.js";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";
import DcsFormLoadingSpinner from "../components/DcsFormLoadingSpinner.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";
import DcsErrorBoundary from "../components/DcsErrorBoundary.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const DANGER = "#E74C3C";
const WARNING = "#F39C12";
const GRAY = "#9E9E9E";
const NEUTRAL_DARK = "#333333";
const NEUTRAL_LIGHT = "#F7F9FB";
const BORDER = "#E0E0E0";
const fontHeading = "'Montserrat', sans-serif";
const PAGE_SIZE = 10;
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 160;
const CERTIFICATE_ACCEPT = ".pdf,.p12,.pfx,.cer,.crt,.pem,.der,.sig,.png,.jpg,.jpeg";

const STATE_STYLES = {
  ready: { background: PRIMARY, color: "#FFFFFF", key: "DCS_MYAPPROVALS_STATUS_READY" },
  waiting: { background: "rgba(243,156,18,0.15)", color: WARNING, key: "DCS_MYAPPROVALS_STATUS_WAITING" },
  approved_by_you: { background: "rgba(76,175,80,0.15)", color: SUCCESS, key: "DCS_MYAPPROVALS_STATUS_APPROVED" },
  rejected_by_you: { background: "rgba(231,76,60,0.12)", color: DANGER, key: "DCS_MYAPPROVALS_STATUS_REJECTED" },
  skipped: { background: "#EEEEEE", color: GRAY, key: "DCS_MYAPPROVALS_STATUS_SKIPPED" },
  approved: { background: "rgba(76,175,80,0.15)", color: SUCCESS, key: "DCS_APPROVAL_STATUS_APPROVED" },
  rejected: { background: "rgba(231,76,60,0.12)", color: DANGER, key: "DCS_APPROVAL_STATUS_REJECTED" },
};

// One submitted answer rendered read-only, same rules as the single approval page.
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

function StatePill({ record, translate }) {
  const style = STATE_STYLES[record.state] || STATE_STYLES.skipped;
  const label =
    record.state === "waiting"
      ? translate("DCS_MYAPPROVALS_STATUS_WAITING", { names: (record.pending_names || []).join(", ") })
      : translate(style.key);
  return (
    <span
      className="inline-block text-xs font-bold px-3 py-1.5 whitespace-nowrap"
      style={{ backgroundColor: style.background, color: style.color, fontFamily: fontHeading, borderRadius: 4 }}
      title={label}
    >
      {label}
    </span>
  );
}

// The logged-in approver's own dashboard: every record routed to their email, across all forms.
function MyApprovalsPageContent() {
  const { translate, language } = useDcsLanguage();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [load_state, setLoadState] = useState("loading");
  const [records, setRecords] = useState([]);
  const [forms, setForms] = useState({});
  const [view, setView] = useState("table");
  const [form_filter, setFormFilter] = useState("");
  const [page, setPage] = useState(1);
  const [form_index, setFormIndex] = useState(0);
  const [viewed, setViewed] = useState(() => new Set());
  const [show_modal, setShowModal] = useState(false);
  const [comment, setComment] = useState("");
  const [sign_method, setSignMethod] = useState("drawn");
  const [certificate_file, setCertificateFile] = useState(null);
  const [has_drawn, setHasDrawn] = useState(false);
  const [progress, setProgress] = useState(null);
  const canvas_ref = useRef(null);
  const is_drawing_ref = useRef(false);

  const load = () => {
    setLoadState("loading");
    get_my_approvals()
      .then((response) => {
        setRecords(response.data.records || []);
        setForms(response.data.forms || {});
        setLoadState("ready");
      })
      .catch((error) => {
        showError(error.message || translate("DCS_ERROR_GENERIC"));
        setLoadState("error");
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  // One form at a time: the picked form, defaulting to the first that has records.
  const form_keys = useMemo(() => [...new Set(records.map((record) => record.form_key))], [records]);
  const active_form_key = form_keys.includes(form_filter) ? form_filter : form_keys[0] || null;
  const filtered = useMemo(
    () => records.filter((record) => record.form_key === active_form_key),
    [records, active_form_key],
  );
  const total_pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current_page = Math.min(page, total_pages);
  const page_records = filtered.slice((current_page - 1) * PAGE_SIZE, current_page * PAGE_SIZE);
  const form_record = filtered[Math.min(form_index, Math.max(0, filtered.length - 1))] || null;

  // A record counts as viewed once it has actually been displayed - a table page
  // renders its rows, the form view renders one record at a time.
  useEffect(() => {
    const shown = view === "table" ? page_records.map((record) => record.id) : form_record ? [form_record.id] : [];
    if (shown.length === 0) return;
    setViewed((previous) => {
      if (shown.every((id) => previous.has(id))) return previous;
      const next = new Set(previous);
      shown.forEach((id) => next.add(id));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, current_page, form_index, filtered]);

  const approvable = filtered.filter((record) => record.state === "ready" && viewed.has(record.id));

  // Table columns: every field of the shown form, so the whole record is reviewable in place.
  const field_columns = useMemo(() => {
    if (!active_form_key || !forms[active_form_key]) return [];
    return flatten_fields(forms[active_form_key].schema.fields || []).filter((field) => field.type !== "group");
  }, [active_form_key, forms]);

  // The sidebar mirrors the reference record: the one on screen in form view,
  // otherwise the first record still waiting for this approver.
  const reference_record = view === "form" ? form_record : filtered.find((record) => record.step.status === "pending") || filtered[0] || null;
  const sidebar_message = (reference_record && reference_record.step.message) || "";
  const assigned_to = (() => {
    if (!reference_record) return "-";
    const step = reference_record.step;
    if (step.location && step.location.name) return `${translate(`DCS_APPROVAL_LEVEL_${step.level_type}`)} = ${step.location.name}`;
    return (forms[reference_record.form_key] && forms[reference_record.form_key].form_name) || "-";
  })();

  const display_name = (user && (user.fullName || user.full_name)) || "";
  const initials = display_name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "?";

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
    if (show_modal && sign_method === "drawn") clear_canvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show_modal, sign_method]);

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

  // Approves every viewed+ready record in turn: the one signature file is
  // uploaded per record (each token owns its own upload), then the decision
  // is recorded with the shared comment.
  const handle_bulk_approve = async () => {
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

    const targets = approvable;
    let done = 0;
    let failed = 0;
    for (const record of targets) {
      setProgress({ done: done + failed, total: targets.length });
      try {
        const uploaded = await upload_approval_file(record.step.token, file, null);
        await submit_approval_decision(record.step.token, "approve", comment.trim() || null, { kind: sign_method, file: uploaded });
        done += 1;
      } catch (error) {
        failed += 1;
      }
    }
    setProgress(null);
    setShowModal(false);
    setComment("");
    setCertificateFile(null);
    setHasDrawn(false);
    if (failed === 0) showSuccess(translate("DCS_MYAPPROVALS_DONE", { count: done }));
    else showError(translate("DCS_MYAPPROVALS_PARTIAL", { done, failed }));
    load();
  };

  if (load_state === "loading") return <DcsFormLoadingSpinner />;
  if (load_state === "error") return <DcsEmptyState messageKey="DCS_ERROR_GENERIC" />;

  const label_of = (field) => get_field_text(field.label, language) || field.id;
  const form_view_fields = form_record
    ? flatten_fields((forms[form_record.form_key] || { schema: { fields: [] } }).schema.fields || []).filter(
        (field) => form_record.data && Object.prototype.hasOwnProperty.call(form_record.data, field.id),
      )
    : [];

  return (
    <div className="min-h-screen p-3 sm:p-6" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      <div className="flex flex-col lg:flex-row gap-4 max-w-[1400px] mx-auto items-start">
        {/* Sidebar - approver identity, assignment and the author's message */}
        <div className="w-full lg:w-[320px] shrink-0 bg-white border p-4 space-y-3" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-3 pb-3 border-b" style={{ borderColor: BORDER }}>
            <div className="w-14 h-14 flex items-center justify-center text-white text-xl font-extrabold shrink-0" style={{ backgroundColor: PRIMARY, fontFamily: fontHeading }}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-extrabold truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{display_name}</p>
              {reference_record && (
                <p className="text-sm font-semibold" style={{ color: PRIMARY, fontFamily: fontHeading }}>{reference_record.step.role}</p>
              )}
            </div>
          </div>

          {user && user.telephone && (
            <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
              <p className="text-xs font-bold uppercase" style={{ color: GRAY, fontFamily: fontHeading, letterSpacing: 0.5 }}>{translate("DCS_MYAPPROVALS_TELEPHONE")}</p>
              <p className="text-sm mt-1 font-semibold" style={{ color: NEUTRAL_DARK }}>{user.telephone}</p>
            </div>
          )}
          <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
            <p className="text-xs font-bold uppercase" style={{ color: GRAY, fontFamily: fontHeading, letterSpacing: 0.5 }}>{translate("DCS_MYAPPROVALS_EMAIL")}</p>
            <p className="text-sm mt-1 font-semibold break-all" style={{ color: NEUTRAL_DARK }}>{(user && user.email) || "-"}</p>
          </div>
          <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
            <p className="text-xs font-bold uppercase" style={{ color: GRAY, fontFamily: fontHeading, letterSpacing: 0.5 }}>{translate("DCS_MYAPPROVALS_ASSIGNED_TO")}</p>
            <p className="text-sm mt-1 font-semibold" style={{ color: NEUTRAL_DARK }}>{assigned_to}</p>
          </div>
          <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
            <p className="text-xs font-bold uppercase" style={{ color: GRAY, fontFamily: fontHeading, letterSpacing: 0.5 }}>{translate("DCS_APPROVAL_MESSAGE_FOR_YOU")}</p>
            <p className="text-sm mt-1" style={{ color: NEUTRAL_DARK }}>{sidebar_message || translate("DCS_MYAPPROVALS_DEFAULT_MESSAGE")}</p>
          </div>
        </div>

        {/* Records panel */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="inline-flex border" style={{ borderColor: BORDER, backgroundColor: "#FFFFFF" }}>
              {["table", "form"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  className="cursor-pointer text-sm font-bold px-4 py-2.5"
                  style={{
                    fontFamily: fontHeading,
                    backgroundColor: view === mode ? PRIMARY : "transparent",
                    color: view === mode ? "#FFFFFF" : GRAY,
                  }}
                >
                  {translate(mode === "table" ? "DCS_MYAPPROVALS_TABLE_VIEW" : "DCS_MYAPPROVALS_FORM_VIEW")}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {form_keys.length > 1 && (
                <select
                  value={active_form_key || ""}
                  onChange={(event) => {
                    setFormFilter(event.target.value);
                    setPage(1);
                    setFormIndex(0);
                  }}
                  className="cok-auth-input pr-3 py-2 text-sm"
                  style={{ backgroundColor: "#FFFFFF" }}
                >
                  {form_keys.map((key) => (
                    <option key={key} value={key}>{(forms[key] && forms[key].form_name) || key}</option>
                  ))}
                </select>
              )}
              <DcsButtonPrimary onClick={() => setShowModal(true)} disabled={approvable.length === 0}>
                {translate("DCS_MYAPPROVALS_APPROVE_ALL", { count: approvable.length })}
              </DcsButtonPrimary>
            </div>
          </div>

          <p className="text-sm mt-3" style={{ color: "#555555", fontFamily: fontHeading }}>
            {translate("DCS_MYAPPROVALS_VIEWED_HINT", { viewed: filtered.filter((record) => viewed.has(record.id)).length, total: filtered.length })}
          </p>

          {filtered.length === 0 && (
            <div className="mt-6">
              <DcsEmptyState messageKey="DCS_MYAPPROVALS_EMPTY" />
            </div>
          )}

          {/* Table view */}
          {filtered.length > 0 && view === "table" && (
            <>
              <div className="mt-3 overflow-x-auto bg-white border" style={{ borderColor: BORDER }}>
                <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: PRIMARY }}>
                      {field_columns.map((field) => (
                        <th key={field.id} className="px-4 py-3 text-sm font-bold text-white whitespace-nowrap" style={{ fontFamily: fontHeading }}>{label_of(field)}</th>
                      ))}
                      <th className="px-4 py-3 text-sm font-bold text-white whitespace-nowrap" style={{ fontFamily: fontHeading }}>{translate("DCS_MYAPPROVALS_COL_SUBMITTED")}</th>
                      <th className="px-4 py-3 text-sm font-bold text-white whitespace-nowrap" style={{ fontFamily: fontHeading }}>{translate("DCS_MYAPPROVALS_COL_STATUS")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page_records.map((record) => (
                      <tr key={record.id} className="border-t" style={{ borderColor: BORDER }}>
                        {field_columns.map((field) => (
                          <td key={field.id} className="px-4 py-3 text-sm" style={{ color: NEUTRAL_DARK }}>
                            <AnswerValue value={record.data[field.id]} />
                          </td>
                        ))}
                        <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: "#555555" }}>
                          {record.submitted_at ? new Date(record.submitted_at).toLocaleDateString() : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {record.state === "ready" ? (
                            <a href={build_approval_link(record.step.token)} className="no-underline">
                              <StatePill record={record} translate={translate} />
                            </a>
                          ) : (
                            <StatePill record={record} translate={translate} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <DcsButtonOutline onClick={() => setPage(Math.max(1, current_page - 1))} disabled={current_page <= 1}>
                  {translate("DCS_MYAPPROVALS_PREVIOUS")}
                </DcsButtonOutline>
                <span className="text-sm font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                  {translate("DCS_MYAPPROVALS_PAGE_OF", { page: current_page, pages: total_pages })}
                </span>
                <DcsButtonOutline onClick={() => setPage(Math.min(total_pages, current_page + 1))} disabled={current_page >= total_pages}>
                  {translate("DCS_MYAPPROVALS_NEXT")}
                </DcsButtonOutline>
              </div>
            </>
          )}

          {/* Form view - one record at a time */}
          {filtered.length > 0 && view === "form" && form_record && (
            <div className="mt-3 bg-white border p-4 sm:p-6" style={{ borderColor: BORDER }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-base font-extrabold" style={{ color: PRIMARY, fontFamily: fontHeading }}>
                    {(forms[form_record.form_key] && forms[form_record.form_key].form_name) || "-"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: GRAY, fontFamily: fontHeading }}>
                    {form_record.submitted_at ? new Date(form_record.submitted_at).toLocaleString() : ""}
                  </p>
                </div>
                <StatePill record={form_record} translate={translate} />
              </div>

              {form_record.step.message && (
                <div className="mt-3 px-3 py-2" style={{ backgroundColor: "rgba(5,109,170,0.06)", borderLeft: `3px solid ${PRIMARY}` }}>
                  <p className="text-xs font-semibold uppercase" style={{ color: PRIMARY, fontFamily: fontHeading, letterSpacing: 0.5 }}>
                    {translate("DCS_APPROVAL_MESSAGE_FOR_YOU")}
                  </p>
                  <p className="text-sm mt-1" style={{ color: NEUTRAL_DARK }}>{form_record.step.message}</p>
                </div>
              )}

              <div className="border mt-4" style={{ borderColor: BORDER }}>
                {form_view_fields.length === 0 && <p className="p-3 text-sm" style={{ color: GRAY }}>-</p>}
                {form_view_fields.map((field, index) => (
                  <div key={field.id} className="p-3 flex flex-col gap-1" style={{ borderTop: index === 0 ? "none" : `1px solid ${BORDER}` }}>
                    <span className="text-xs font-semibold uppercase" style={{ color: GRAY, fontFamily: fontHeading, letterSpacing: 0.5 }}>{label_of(field)}</span>
                    <span className="text-sm" style={{ color: NEUTRAL_DARK }}><AnswerValue value={form_record.data[field.id]} /></span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <DcsButtonOutline onClick={() => setFormIndex(Math.max(0, form_index - 1))} disabled={form_index <= 0}>
                    {translate("DCS_MYAPPROVALS_PREVIOUS")}
                  </DcsButtonOutline>
                  <span className="text-sm font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                    {translate("DCS_MYAPPROVALS_RECORD_OF", { index: Math.min(form_index, filtered.length - 1) + 1, total: filtered.length })}
                  </span>
                  <DcsButtonOutline onClick={() => setFormIndex(Math.min(filtered.length - 1, form_index + 1))} disabled={form_index >= filtered.length - 1}>
                    {translate("DCS_MYAPPROVALS_NEXT")}
                  </DcsButtonOutline>
                </div>
                <a href={build_approval_link(form_record.step.token)} className="text-sm font-semibold underline" style={{ color: PRIMARY, fontFamily: fontHeading }}>
                  {translate("DCS_MYAPPROVALS_OPEN")}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bulk approve modal - the signature is still required, exactly like the single page */}
      {show_modal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="w-full max-w-lg bg-white max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4" style={{ backgroundColor: PRIMARY }}>
              <h2 className="text-white font-bold text-base" style={{ fontFamily: fontHeading }}>
                {translate("DCS_MYAPPROVALS_MODAL_TITLE", { count: approvable.length })}
              </h2>
            </div>
            <div className="p-5">
              <p className="text-sm" style={{ color: "#555555", fontFamily: fontHeading }}>{translate("DCS_MYAPPROVALS_MODAL_HINT")}</p>

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
                    <DcsButtonOutline onClick={clear_canvas} disabled={progress !== null}>
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

              <div className="flex gap-3 mt-5 flex-wrap">
                <DcsButtonOutline onClick={() => setShowModal(false)} disabled={progress !== null} className="flex-1">
                  {translate("DCS_MYAPPROVALS_CANCEL")}
                </DcsButtonOutline>
                <DcsButtonPrimary onClick={handle_bulk_approve} disabled={progress !== null || approvable.length === 0} className="flex-1">
                  {progress !== null
                    ? translate("DCS_MYAPPROVALS_PROGRESS", { done: progress.done, total: progress.total })
                    : translate("DCS_MYAPPROVALS_CONFIRM")}
                </DcsButtonPrimary>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Authenticated route /dcs-my-approvals, with its own DCS language provider like the token page.
export default function MyApprovalsPage() {
  return (
    <DcsErrorBoundary>
      <DcsLanguageProvider>
        <MyApprovalsPageContent />
      </DcsLanguageProvider>
    </DcsErrorBoundary>
  );
}
