import React, { useState, useEffect, useMemo, useRef } from "react";
import { DcsLanguageProvider, useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useAuth } from "../../../core/contexts/AuthContext";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_my_approvals, submit_approval_decision, upload_approval_file } from "../services/approvalsService.js";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";
import DcsFormLoadingSpinner from "../components/DcsFormLoadingSpinner.jsx";
import DcsEmptyState from "../components/DcsEmptyState.jsx";
import DcsErrorBoundary from "../components/DcsErrorBoundary.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsApprovalDecisionModal from "../components/DcsApprovalDecisionModal.jsx";
import DcsApproverPanel from "../components/DcsApproverPanel.jsx";
import DcsDetailsToggleButton from "../components/DcsDetailsToggleButton.jsx";
import DcsPagerButton from "../components/DcsPagerButton.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const DANGER = "#E74C3C";
const WARNING = "#F39C12";
const GRAY = "#9E9E9E";
const NEUTRAL_DARK = "#333333";
const NEUTRAL_LIGHT = "#F7F9FB";
const BORDER = "#E0E0E0";
const CARD_BORDER = "rgba(5,109,170,0.35)";
const fontHeading = "'Montserrat', sans-serif";
// How many records each scroll batch loads - also the rough number of visible rows.
const PAGE_SIZE = 8;
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

// Approve / Reject pair for one ready record, opens the single-record decision popup.
function DecisionButtons({ record, translate, onDecide }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <button
        type="button"
        onClick={() => onDecide({ record, decision: "approve" })}
        className="cursor-pointer text-xs font-bold px-3 py-1.5"
        style={{ backgroundColor: PRIMARY, color: "#FFFFFF", fontFamily: fontHeading, borderRadius: 4 }}
      >
        {translate("DCS_APPROVAL_BTN_APPROVE")}
      </button>
      <button
        type="button"
        onClick={() => onDecide({ record, decision: "reject" })}
        className="cursor-pointer text-xs font-bold px-3 py-1.5"
        style={{ backgroundColor: "transparent", color: DANGER, border: `1px solid ${DANGER}`, fontFamily: fontHeading, borderRadius: 4 }}
      >
        {translate("DCS_APPROVAL_BTN_REJECT")}
      </button>
    </div>
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
  const [form_options, setFormOptions] = useState([]);
  const [active_form_key, setActiveFormKey] = useState(null);
  const [total, setTotal] = useState(0);
  const [has_more, setHasMore] = useState(false);
  const [loading_more, setLoadingMore] = useState(false);
  const [batch_error, setBatchError] = useState(false);
  const [view, setView] = useState("table");
  const [form_index, setFormIndex] = useState(0);
  const [viewed, setViewed] = useState(() => new Set());
  const [panel_open, setPanelOpen] = useState(
    () => typeof window === "undefined" || window.matchMedia("(min-width: 768px)").matches,
  );
  const [show_modal, setShowModal] = useState(false);
  const [decision_target, setDecisionTarget] = useState(null);
  const [comment, setComment] = useState("");
  const [sign_method, setSignMethod] = useState("drawn");
  const [certificate_file, setCertificateFile] = useState(null);
  const [has_drawn, setHasDrawn] = useState(false);
  const [progress, setProgress] = useState(null);
  const canvas_ref = useRef(null);
  const is_drawing_ref = useRef(false);

  // Guards against overlapping batch requests - scroll events fire faster than state settles.
  const fetching_ref = useRef(false);
  const table_scroll_ref = useRef(null);

  // Applies one backend batch: replace the loaded rows or append the next scroll batch.
  const apply_batch = (data, mode) => {
    setForms(data.forms || {});
    setFormOptions(data.form_options || []);
    setActiveFormKey(data.active_form_key || null);
    setTotal(data.total || 0);
    setHasMore(Boolean(data.has_more));
    setRecords((previous) => (mode === "append" ? [...previous, ...(data.records || [])] : data.records || []));
  };

  // First batch of a form: the whole-page spinner on mount, an in-table loader when switching forms.
  const load = (form_key, options = {}) => {
    if (fetching_ref.current) return;
    fetching_ref.current = true;
    if (options.first) setLoadState("loading");
    else setLoadingMore(true);
    setRecords([]);
    setFormIndex(0);
    get_my_approvals({ form_key, offset: 0, limit: PAGE_SIZE })
      .then((response) => {
        apply_batch(response.data, "replace");
        setBatchError(false);
        setLoadState("ready");
      })
      .catch((error) => {
        showError(error.message || translate("DCS_ERROR_GENERIC"));
        setBatchError(true);
        if (options.first) setLoadState("error");
      })
      .finally(() => {
        fetching_ref.current = false;
        setLoadingMore(false);
      });
  };

  // Next scroll batch, appended below the rows already on screen.
  const load_more = (after_load) => {
    if (fetching_ref.current || !has_more || !active_form_key) return;
    fetching_ref.current = true;
    setLoadingMore(true);
    get_my_approvals({ form_key: active_form_key, offset: records.length, limit: PAGE_SIZE })
      .then((response) => {
        apply_batch(response.data, "append");
        setBatchError(false);
        if (after_load) after_load(records.length + (response.data.records || []).length);
      })
      .catch((error) => {
        showError(error.message || translate("DCS_ERROR_GENERIC"));
        setBatchError(true);
      })
      .finally(() => {
        fetching_ref.current = false;
        setLoadingMore(false);
      });
  };

  // After a decision: re-read exactly the rows already loaded so states update without losing scroll position.
  const refresh = () => {
    if (fetching_ref.current) return;
    fetching_ref.current = true;
    setLoadingMore(true);
    get_my_approvals({ form_key: active_form_key, offset: 0, limit: Math.max(PAGE_SIZE, records.length) })
      .then((response) => apply_batch(response.data, "replace"))
      .catch((error) => showError(error.message || translate("DCS_ERROR_GENERIC")))
      .finally(() => {
        fetching_ref.current = false;
        setLoadingMore(false);
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => load(null, { first: true }), []);

  const form_record = records[Math.min(form_index, Math.max(0, records.length - 1))] || null;

  const handle_table_scroll = (event) => {
    const element = event.currentTarget;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 80) load_more();
  };

  // On tall screens one batch may not overflow the container, leaving nothing to scroll - keep fetching until it does.
  useEffect(() => {
    const element = table_scroll_ref.current;
    if (!element || view !== "table" || !has_more || loading_more) return;
    if (element.scrollHeight <= element.clientHeight + 4) load_more();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, has_more, loading_more, view]);

  // A record counts as viewed once it has actually been displayed - the table
  // renders every loaded row, the form view renders one record at a time.
  useEffect(() => {
    const shown = view === "table" ? records.map((record) => record.id) : form_record ? [form_record.id] : [];
    if (shown.length === 0) return;
    setViewed((previous) => {
      if (shown.every((id) => previous.has(id))) return previous;
      const next = new Set(previous);
      shown.forEach((id) => next.add(id));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, form_index, records]);

  const approvable = records.filter((record) => record.state === "ready" && viewed.has(record.id));

  // Table columns: every field of the shown form, so the whole record is reviewable in place.
  const field_columns = useMemo(() => {
    if (!active_form_key || !forms[active_form_key]) return [];
    return flatten_fields(forms[active_form_key].schema.fields || []).filter((field) => field.type !== "group");
  }, [active_form_key, forms]);

  // The sidebar mirrors the reference record: the one on screen in form view,
  // otherwise the first record still waiting for this approver.
  const reference_record = view === "form" ? form_record : records.find((record) => record.step.status === "pending") || records[0] || null;
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
    refresh();
  };

  if (load_state === "loading") return <DcsFormLoadingSpinner />;
  if (load_state === "error")
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        <DcsEmptyState messageKey="DCS_ERROR_GENERIC" />
        <button type="button" onClick={() => load(active_form_key, { first: true })} className="dcs-retry-link text-sm" style={{ fontFamily: fontHeading }}>
          {translate("DCS_MYAPPROVALS_RETRY")}
        </button>
      </div>
    );

  const label_of = (field) => get_field_text(field.label, language) || field.id;
  const form_view_fields = form_record
    ? flatten_fields((forms[form_record.form_key] || { schema: { fields: [] } }).schema.fields || []).filter(
        (field) => form_record.data && Object.prototype.hasOwnProperty.call(form_record.data, field.id),
      )
    : [];

  return (
    // On desktop the page is fixed to the viewport and only the records list scrolls.
    <div className="min-h-screen p-2 sm:p-4 min-[760px]:p-6 lg:h-screen lg:overflow-hidden" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      <div className="flex flex-col lg:flex-row lg:gap-0 max-w-[1400px] mx-auto items-stretch lg:items-start lg:h-full">
        <div className={`shrink-0 w-full lg:h-full dcs-details-panel ${panel_open ? "is-open mb-3 lg:mb-0" : "is-closed"}`}>
          <DcsApproverPanel
            user={user}
            initials={initials}
            displayName={display_name}
            role={reference_record ? reference_record.step.role : ""}
            assignedTo={assigned_to}
            message={sidebar_message}
            onClose={() => setPanelOpen(false)}
          />
        </div>

        {/* Records panel - a column on desktop so the toolbar and pager stay fixed while rows scroll */}
        <div className="flex-1 min-w-0 w-full lg:h-full lg:min-h-0 lg:flex lg:flex-col">
          <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
            <span className={`dcs-details-toggle-slot ${panel_open ? "is-hidden" : "is-shown"}`}>
              <DcsDetailsToggleButton isOpen={false} onClick={() => setPanelOpen(true)} />
            </span>
            <div className="inline-flex border-2" style={{ borderColor: CARD_BORDER, backgroundColor: "#FFFFFF" }}>
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
              {form_options.length > 1 && (
                <select
                  value={active_form_key || ""}
                  onChange={(event) => load(event.target.value)}
                  disabled={loading_more}
                  className="cok-auth-input pr-3 py-2 text-sm cursor-pointer"
                  style={{ backgroundColor: "#FFFFFF" }}
                >
                  {form_options.map((option) => (
                    <option key={option.form_key} value={option.form_key}>{option.form_name} ({option.count})</option>
                  ))}
                </select>
              )}
              <DcsButtonPrimary onClick={() => setShowModal(true)} disabled={approvable.length === 0}>
                {translate("DCS_MYAPPROVALS_APPROVE_ALL", { count: approvable.length })}
              </DcsButtonPrimary>
            </div>
          </div>

          <p className="text-sm mt-3" style={{ color: "#555555", fontFamily: fontHeading }}>
            {translate("DCS_MYAPPROVALS_VIEWED_HINT", { viewed: records.filter((record) => viewed.has(record.id)).length, total })}
          </p>

          {total === 0 && !loading_more && (
            <div className="mt-6">
              <DcsEmptyState messageKey="DCS_MYAPPROVALS_EMPTY" />
            </div>
          )}

          {/* Table view */}
          {(total > 0 || loading_more) && view === "table" && (
            <>

              {/* max-h controls how many rows are visible (~44px header + ~48px per row) - scrolling inside reveals the next batch */}
              <div key="table" ref={table_scroll_ref} onScroll={handle_table_scroll} className="dcs-view-swap mt-3 mb-0 overflow-x-auto overflow-y-auto max-h-[60vh] lg:max-h-none bg-white border-2 min-[760px]:border-[5px] min-[760px]:rounded-[5px] lg:flex-1 lg:min-h-0" style={{ borderColor: CARD_BORDER }}>
                <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    {/* Sticky on the th (not the tr) so the header survives vertical scrolling */}
                    <tr style={{ backgroundColor: PRIMARY }}>
                      {field_columns.map((field) => (
                        <th key={field.id} className="px-4 py-3 text-sm font-bold text-white whitespace-nowrap sticky top-0" style={{ fontFamily: fontHeading, backgroundColor: PRIMARY }}>{label_of(field)}</th>
                      ))}
                      <th className="px-4 py-3 text-sm font-bold text-white whitespace-nowrap sticky top-0" style={{ fontFamily: fontHeading, backgroundColor: PRIMARY }}>{translate("DCS_MYAPPROVALS_COL_SUBMITTED")}</th>
                      <th className="px-4 py-3 text-sm font-bold text-white whitespace-nowrap sticky top-0" style={{ fontFamily: fontHeading, backgroundColor: PRIMARY }}>{translate("DCS_MYAPPROVALS_COL_STATUS")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, row_index) => (
                      <tr key={record.id} className={`border-t ${row_index % 2 === 0 ? "dcs-approvals-row-odd" : "dcs-approvals-row-even"}`} style={{ borderColor: BORDER }}>
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
                            <DecisionButtons record={record} translate={translate} onDecide={setDecisionTarget} />
                          ) : (
                            <StatePill record={record} translate={translate} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Below the rows: the batch loader while the backend answers, or a quiet "all loaded" once it is done */}
                {loading_more && (
                  <div className="flex items-center justify-center gap-3 py-4 border-t" style={{ borderColor: BORDER }}>
                    <SpiralLoader padded={false} size={20} />
                    <span className="text-sm" style={{ color: GRAY, fontFamily: fontHeading }}>{translate("DCS_MYAPPROVALS_LOADING_MORE")}</span>
                  </div>
                )}
                {!loading_more && batch_error && (
                  <div className="flex items-center justify-center gap-2 py-4 border-t" style={{ borderColor: BORDER }}>
                    <span className="text-sm" style={{ color: GRAY, fontFamily: fontHeading }}>{translate("DCS_MYAPPROVALS_LOAD_FAILED")}</span>
                    <button type="button" onClick={() => load(active_form_key, { first: records.length === 0 })} className="dcs-retry-link text-sm" style={{ fontFamily: fontHeading }}>
                      {translate("DCS_MYAPPROVALS_RETRY")}
                    </button>
                  </div>
                )}
                {!loading_more && !batch_error && !has_more && records.length > 0 && (
                  <p className="text-center text-xs py-3 border-t" style={{ color: GRAY, fontFamily: fontHeading, borderColor: BORDER }}>
                    {translate("DCS_MYAPPROVALS_ALL_LOADED", { total })}
                  </p>
                )}
              </div>
            </>
          )}

          {records.length > 0 && view === "form" && form_record && (
            <div
              key="form"
              className="dcs-view-swap mt-3 bg-white border-2 min-[760px]:border-[5px] min-[760px]:rounded-[5px] flex flex-col overflow-hidden max-h-[70vh] lg:max-h-none lg:flex-1 lg:min-h-0"
              style={{ borderColor: CARD_BORDER }}
            >
              <div className="shrink-0 p-3 sm:p-4 min-[760px]:p-6 pb-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: `2px solid ${CARD_BORDER}` }}>
                <div className="min-w-0">
                  <p className="text-base font-extrabold" style={{ color: PRIMARY, fontFamily: fontHeading }}>
                    {(forms[form_record.form_key] && forms[form_record.form_key].form_name) || "-"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: GRAY, fontFamily: fontHeading }}>
                    {form_record.submitted_at ? new Date(form_record.submitted_at).toLocaleString() : ""}
                  </p>
                </div>
                {form_record.state === "ready" ? (
                  <DecisionButtons record={form_record} translate={translate} onDecide={setDecisionTarget} />
                ) : (
                  <StatePill record={form_record} translate={translate} />
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 min-[760px]:px-6 py-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
                <div className="w-full min-[760px]:max-w-[700px] mx-auto bg-white p-4 flex flex-col gap-4 border-0 min-[760px]:border-2" style={{ borderColor: PRIMARY }}>
                  {form_view_fields.length === 0 && <p className="text-sm" style={{ color: GRAY }}>-</p>}
                  {form_view_fields.map((field) => (
                    <div key={field.id} className="flex flex-col gap-1.5">
                      <span className="text-sm font-semibold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{label_of(field)}</span>
                      <div className="text-sm px-3 py-2.5 border" style={{ borderColor: BORDER, backgroundColor: NEUTRAL_LIGHT, color: NEUTRAL_DARK }}>
                        <AnswerValue value={form_record.data[field.id]} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="shrink-0 flex items-center justify-center gap-4 px-3 py-3 bg-white" style={{ borderTop: `2px solid ${CARD_BORDER}` }}>
                <DcsPagerButton
                  direction="previous"
                  title={translate("DCS_MYAPPROVALS_PREVIOUS")}
                  onClick={() => setFormIndex(Math.max(0, form_index - 1))}
                  disabled={form_index <= 0 || loading_more}
                />
                <span className="text-sm font-bold whitespace-nowrap" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                  {translate("DCS_MYAPPROVALS_RECORD_OF", { index: Math.min(form_index, records.length - 1) + 1, total })}
                </span>
                <DcsPagerButton
                  direction="next"
                  title={translate("DCS_MYAPPROVALS_NEXT")}
                  onClick={() => {
                    if (form_index < records.length - 1) setFormIndex(form_index + 1);
                    else load_more((loaded) => setFormIndex(Math.min(loaded - 1, form_index + 1)));
                  }}
                  disabled={loading_more || (form_index >= records.length - 1 && !has_more)}
                />
                {loading_more && <SpiralLoader padded={false} size={18} />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Single-record decision popup - approve or reject in place, no navigation */}
      {decision_target && (
        <DcsApprovalDecisionModal
          record={decision_target.record}
          form={forms[decision_target.record.form_key]}
          decision={decision_target.decision}
          onClose={() => setDecisionTarget(null)}
          onDone={() => {
            setDecisionTarget(null);
            refresh();
          }}
        />
      )}

      {/* Bulk approve modal - the signature is still required, exactly like the single page */}
      {show_modal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="w-full max-w-lg bg-white max-h-[90vh] overflow-y-auto border-2 min-[760px]:rounded-[5px]" style={{ borderColor: PRIMARY }}>
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
