import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_form_versions } from "../services/formsService.js";
import {
  generate_test_data,
  get_test_data_job,
  delete_test_data,
  generate_test_approvals,
  clear_test_approvals,
} from "../services/testDataService.js";
import { flatten_condition_fields } from "../builder/ApprovalFlowSection.jsx";
import { get_field_text } from "../fields/fieldText.js";
import DcsButtonOutline from "./DcsButtonOutline.jsx";
import DcsButtonOutlineDanger from "./DcsButtonOutlineDanger.jsx";
import DcsButtonPrimary from "./DcsButtonPrimary.jsx";

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const DANGER = "#E74C3C";
const BORDER = "#E0E0E0";
const GRAY = "#9E9E9E";
const WHITE = "#FFFFFF";
const NEUTRAL_LIGHT = "#F7F9FB";
const FONT = "'Montserrat', sans-serif";

const LABEL_STYLE = { color: "#333333", fontFamily: FONT };
const MUTED_STYLE = { color: GRAY, fontFamily: FONT };

function parent_link_of(field, fields_by_id) {
  if (field.parent_field_id && fields_by_id.has(field.parent_field_id)) return field.parent_field_id;
  if (field.type === "select_group" && field.parent_dependency_enabled) {
    const group = (field.parent_option_groups || []).find((entry) => entry && entry.parent_field_id && fields_by_id.has(entry.parent_field_id));
    if (group) return group.parent_field_id;
  }
  return null;
}

function build_cascading_chains(fields) {
  const fields_by_id = new Map(fields.map((field) => [field.id, field]));
  const child_of = new Map();
  fields.forEach((field) => {
    const parent_id = parent_link_of(field, fields_by_id);
    if (parent_id && !child_of.has(parent_id)) child_of.set(parent_id, field);
  });
  const chains = [];
  fields.forEach((field) => {
    const has_parent = !!parent_link_of(field, fields_by_id);
    if (has_parent || !child_of.has(field.id)) return;
    const levels = [field];
    let current = field;
    while (child_of.has(current.id)) {
      current = child_of.get(current.id);
      levels.push(current);
    }
    chains.push({ id: field.id, levels });
  });
  return chains;
}

function TestOverlay({ titleKey, onClose, busy, children }) {
  const { translate } = useDcsLanguage();
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onClose} />
      <div className="relative bg-white border-2 w-full flex flex-col" style={{ maxWidth: 540, borderColor: PRIMARY, maxHeight: "85vh" }}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 shrink-0" style={{ backgroundColor: PRIMARY }}>
          <p className="text-base font-extrabold uppercase leading-tight" style={{ color: WHITE, fontFamily: FONT, letterSpacing: "-0.5px" }}>
            {translate(titleKey)}
          </p>
          <button
            type="button"
            onClick={busy ? undefined : onClose}
            disabled={busy}
            className="text-xs font-semibold uppercase cursor-pointer shrink-0"
            style={{ color: WHITE, background: "none", border: `1px solid rgba(255,255,255,0.6)`, padding: "0.25rem 0.6rem", fontFamily: FONT }}
          >
            {translate("DCS_BTN_CLOSE")}
          </button>
        </div>
        <div className="p-5 overflow-y-auto" style={{ minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ labelKey }) {
  const { translate } = useDcsLanguage();
  return <label className="cok-auth-label">{translate(labelKey)}</label>;
}

/**
 * One long-poll round that survives transient network failures: a heavy
 * generation can momentarily starve the server or trip a proxy, killing a
 * single poll request - the job itself keeps running, so the poll simply
 * retries a few times before giving up for real.
 */
async function poll_job_with_retry(job_id, known_percent) {
  let last_error = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await get_test_data_job(job_id, known_percent);
    } catch (error) {
      last_error = error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw last_error;
}

function JobProgress({ job }) {
  const { translate } = useDcsLanguage();
  return (
    <div>
      <div className="w-full" style={{ height: 8, backgroundColor: BORDER }}>
        <div style={{ height: 8, width: `${job ? job.percent : 0}%`, backgroundColor: PRIMARY, transition: "width 0.3s ease" }} />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs font-semibold" style={{ color: PRIMARY, fontFamily: FONT }}>
          {translate("DCS_TEST_DATA_PROGRESS", { percent: job ? job.percent : 0 })}
        </span>
        <span className="text-xs" style={MUTED_STYLE}>
          {translate("DCS_TEST_DATA_SAVED_LABEL")}: {job ? job.saved : 0} | {translate("DCS_TEST_DATA_FAILED_LABEL")}: {job ? job.failed : 0}
        </span>
      </div>
    </div>
  );
}

function GenerateTestDataOverlay({ formGroupId, versions, versionsLoading, onClose }) {
  const { translate } = useDcsLanguage();
  const { showError, showSuccess } = useToast();
  const [version, setVersion] = useState(versions.length > 0 ? String(versions[0].version) : "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [min_per_hour, setMinPerHour] = useState("1");
  const [max_per_hour, setMaxPerHour] = useState("5");
  const [job, setJob] = useState(null);
  const [running, setRunning] = useState(false);
  const cancelled_ref = useRef(false);

  useEffect(() => {
    cancelled_ref.current = false;
    return () => {
      cancelled_ref.current = true;
    };
  }, []);

  // The overlay can open while the versions are still being fetched - the
  // initial state above would then stay empty forever (state initializers
  // never re-run), silently failing the start validation. Once the list
  // lands, the first (latest) version is selected automatically.
  useEffect(() => {
    if (!version && versions.length > 0) setVersion(String(versions[0].version));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions]);

  const handle_start = async () => {
    if (!version) {
      showError(translate(versionsLoading ? "DCS_TEST_DATA_VERSIONS_LOADING" : "DCS_TEST_DATA_VERSION_REQUIRED"));
      return;
    }
    if (!from || !to || new Date(from) >= new Date(to)) {
      showError(translate("DCS_TEST_DATA_RANGE_INVALID"));
      return;
    }
    const min_rate = parseInt(min_per_hour, 10);
    const max_rate = parseInt(max_per_hour, 10);
    if (!Number.isFinite(min_rate) || !Number.isFinite(max_rate) || min_rate < 0 || max_rate < 1 || min_rate > max_rate) {
      showError(translate("DCS_TEST_DATA_RATE_INVALID"));
      return;
    }

    setRunning(true);
    setJob(null);
    try {
      const started = await generate_test_data(formGroupId, {
        version: Number(version),
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        min_per_hour: min_rate,
        max_per_hour: max_rate,
      });
      const job_id = started.data.job_id;
      let known_percent = -1;
      let current = null;
      while (!cancelled_ref.current) {
        const response = await poll_job_with_retry(job_id, known_percent);
        current = response.data;
        setJob(current);
        known_percent = current.percent;
        if (current.status !== "running") break;
      }
      if (current && current.status === "completed") {
        showSuccess(translate("DCS_TEST_DATA_DONE", { saved: current.saved, failed: current.failed }));
      } else if (current && current.status === "error") {
        showError(current.error || translate("DCS_ERROR_GENERIC"));
      } else if (!cancelled_ref.current) {
        showError(translate("DCS_ERROR_GENERIC"));
      }
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setRunning(false);
    }
  };

  const is_done = job && job.status !== "running" && !running;

  return (
    <TestOverlay titleKey="DCS_TEST_DATA_GENERATE_TITLE" onClose={onClose} busy={running}>
      <div className="space-y-3">
        <div>
          <FieldLabel labelKey="DCS_TEST_DATA_VERSION_LABEL" />
          {versionsLoading ? (
            <div className="cok-auth-input w-full py-3 flex items-center gap-2">
              <span className="dcs-inline-spinner" style={{ color: PRIMARY }} />
              <span className="text-xs" style={MUTED_STYLE}>
                {translate("DCS_TEST_DATA_VERSIONS_LOADING")}
              </span>
            </div>
          ) : (
            <select className="cok-auth-input w-full py-3" value={version} disabled={running} onChange={(event) => setVersion(event.target.value)}>
              {versions.map((entry) => (
                <option key={entry.version} value={String(entry.version)}>
                  {translate("DCS_VERSION_OPTION_LABEL", { version: entry.version })}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel labelKey="DCS_TEST_DATA_FROM_LABEL" />
            <input type="datetime-local" className="cok-auth-input w-full py-3" value={from} disabled={running} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div>
            <FieldLabel labelKey="DCS_TEST_DATA_TO_LABEL" />
            <input type="datetime-local" className="cok-auth-input w-full py-3" value={to} disabled={running} onChange={(event) => setTo(event.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel labelKey="DCS_TEST_DATA_MIN_PER_HOUR" />
            <input type="number" min="0" className="cok-auth-input w-full py-3" value={min_per_hour} disabled={running} onChange={(event) => setMinPerHour(event.target.value)} />
          </div>
          <div>
            <FieldLabel labelKey="DCS_TEST_DATA_MAX_PER_HOUR" />
            <input type="number" min="1" className="cok-auth-input w-full py-3" value={max_per_hour} disabled={running} onChange={(event) => setMaxPerHour(event.target.value)} />
          </div>
        </div>

        {(running || job) && <JobProgress job={job} />}

        {is_done && (
          <p className="text-sm" style={{ color: job.status === "completed" ? SUCCESS : DANGER, fontFamily: FONT }}>
            {job.status === "completed"
              ? translate("DCS_TEST_DATA_DONE", { saved: job.saved, failed: job.failed })
              : job.error || translate("DCS_ERROR_GENERIC")}
          </p>
        )}

        {running ? (
          <div className="flex items-center gap-2">
            <span className="dcs-inline-spinner" style={{ color: PRIMARY }} />
            <span className="text-xs" style={MUTED_STYLE}>
              {translate("DCS_TEST_DATA_PROGRESS", { percent: job ? job.percent : 0 })}
            </span>
          </div>
        ) : (
          <DcsButtonPrimary className="w-full" onClick={handle_start} disabled={versionsLoading}>
            {translate("DCS_TEST_DATA_START_BTN")}
          </DcsButtonPrimary>
        )}
      </div>
    </TestOverlay>
  );
}

function DeleteTestDataOverlay({ formGroupId, versions, versionsLoading, onClose }) {
  const { translate } = useDcsLanguage();
  const { showError, showSuccess } = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState(false);

  const handle_delete = async () => {
    if ((from && !to) || (!from && to) || (from && to && new Date(from) >= new Date(to))) {
      showError(translate("DCS_TEST_DATA_RANGE_INVALID"));
      return;
    }
    setBusy(true);
    try {
      const response = await delete_test_data(formGroupId, {
        from: from ? new Date(from).toISOString() : null,
        to: to ? new Date(to).toISOString() : null,
        version: version === "" ? null : Number(version),
      });
      showSuccess(translate("DCS_TEST_DATA_DELETED_RESULT", { count: response.data.deleted }));
      onClose();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <TestOverlay titleKey="DCS_TEST_DATA_DELETE_TITLE" onClose={onClose} busy={busy}>
      <div className="space-y-3">
        <p className="text-xs" style={MUTED_STYLE}>
          {translate("DCS_TEST_DATA_DELETE_HINT")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel labelKey="DCS_TEST_DATA_FROM_LABEL" />
            <input type="datetime-local" className="cok-auth-input w-full py-3" value={from} disabled={busy} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div>
            <FieldLabel labelKey="DCS_TEST_DATA_TO_LABEL" />
            <input type="datetime-local" className="cok-auth-input w-full py-3" value={to} disabled={busy} onChange={(event) => setTo(event.target.value)} />
          </div>
        </div>
        <div>
          <FieldLabel labelKey="DCS_TEST_DATA_VERSION_LABEL" />
          {versionsLoading ? (
            <div className="cok-auth-input w-full py-3 flex items-center gap-2">
              <span className="dcs-inline-spinner" style={{ color: PRIMARY }} />
              <span className="text-xs" style={MUTED_STYLE}>
                {translate("DCS_TEST_DATA_VERSIONS_LOADING")}
              </span>
            </div>
          ) : (
            <select className="cok-auth-input w-full py-3" value={version} disabled={busy} onChange={(event) => setVersion(event.target.value)}>
              <option value="">{translate("DCS_TEST_DATA_ALL_VERSIONS")}</option>
              {versions.map((entry) => (
                <option key={entry.version} value={String(entry.version)}>
                  {translate("DCS_VERSION_OPTION_LABEL", { version: entry.version })}
                </option>
              ))}
            </select>
          )}
        </div>
        {busy ? (
          <div className="flex items-center justify-center">
            <span className="dcs-inline-spinner" style={{ color: PRIMARY }} />
          </div>
        ) : (
          <DcsButtonOutlineDanger className="w-full" onClick={handle_delete}>
            {translate("DCS_TEST_DATA_DELETE_CONFIRM_BTN")}
          </DcsButtonOutlineDanger>
        )}
      </div>
    </TestOverlay>
  );
}

function GenerateTestApprovalsOverlay({ formGroupId, form, onRefreshForm, onClose }) {
  const { translate, language } = useDcsLanguage();
  const { showError, showSuccess } = useToast();
  const condition_fields = React.useMemo(() => flatten_condition_fields(form.schema.fields || []), [form]);
  const chains = React.useMemo(() => build_cascading_chains(condition_fields), [condition_fields]);
  const fields_by_id = React.useMemo(() => new Map(condition_fields.map((field) => [field.id, field])), [condition_fields]);

  const [wizard_step, setWizardStep] = useState(1);
  const [condition_rows, setConditionRows] = useState(() =>
    chains.flatMap((chain) => [...chain.levels].reverse().map((field) => ({ field_id: field.id, force: true, on_reject: "stop" }))),
  );
  const [show_step_error, setShowStepError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null);
  const [result, setResult] = useState(null);
  const cancelled_ref = useRef(false);

  useEffect(() => {
    cancelled_ref.current = false;
    return () => {
      cancelled_ref.current = true;
    };
  }, []);

  const label_of = (field_id) => {
    const field = fields_by_id.get(field_id);
    return (field && get_field_text(field.label, language)) || field_id;
  };

  const conditions_valid = condition_rows.length > 0 && condition_rows.every((row) => row.field_id);

  const ancestor_fields_of = (field_id) => {
    const ancestors = [];
    let current = fields_by_id.get(field_id);
    for (let guard = 0; guard < 20 && current; guard += 1) {
      const parent_id = parent_link_of(current, fields_by_id);
      if (!parent_id) break;
      const parent = fields_by_id.get(parent_id);
      if (!parent) break;
      ancestors.unshift(parent);
      current = parent;
    }
    return ancestors;
  };

  const group_trail_label = (field_id) => {
    const trail = ancestor_fields_of(field_id).map((entry) => label_of(entry.id));
    trail.push(label_of(field_id));
    return trail.join(" > ");
  };

  const change_row_field = (row_index, field_id) => {
    setConditionRows((previous) => previous.map((row, index) => (index === row_index ? Object.assign({}, row, { field_id }) : row)));
  };

  const remove_row = (row_index) => {
    setConditionRows((previous) => previous.filter((_, index) => index !== row_index));
  };

  const add_row = () => {
    setConditionRows((previous) => previous.concat([{ field_id: "", force: true, on_reject: "stop" }]));
  };

  const set_row_rule = (row_index, key, rule_value) => {
    setConditionRows((previous) => previous.map((row, index) => (index === row_index ? Object.assign({}, row, { [key]: rule_value }) : row)));
  };

  const chain_root_of = (field_id) => {
    const ancestors = ancestor_fields_of(field_id);
    return ancestors.length > 0 ? ancestors[0].id : field_id;
  };

  const grouped_cascade_rows = () => {
    const seen = new Set();
    const by_root = new Map();
    condition_rows.forEach((row, index) => {
      if (!row.field_id || seen.has(row.field_id)) return;
      seen.add(row.field_id);
      const root_id = chain_root_of(row.field_id);
      if (!by_root.has(root_id)) by_root.set(root_id, []);
      by_root.get(root_id).push({ row, index });
    });
    return Array.from(by_root.values());
  };

  const swap_rows = (index_a, index_b) => {
    setConditionRows((previous) => {
      const next = previous.slice();
      const moved = next[index_a];
      next[index_a] = next[index_b];
      next[index_b] = moved;
      return next;
    });
  };

  const go_next = () => {
    if (!conditions_valid) {
      setShowStepError(true);
      return;
    }
    setShowStepError(false);
    setWizardStep(2);
  };

  const handle_generate = async () => {
    const seen_field_ids = new Set();
    const levels = condition_rows.filter((row) => {
      if (!row.field_id || seen_field_ids.has(row.field_id)) return false;
      seen_field_ids.add(row.field_id);
      return true;
    });
    if (levels.length === 0) {
      showError(translate("DCS_TEST_APPROVALS_FIELDS_REQUIRED"));
      return;
    }
    setBusy(true);
    setJob(null);
    setResult(null);
    try {
      const started = await generate_test_approvals(formGroupId, {
        levels: levels.map((row) => ({ field_id: row.field_id, force: row.force, on_reject: row.on_reject })),
      });
      const job_id = started.data.job_id;
      let known_percent = -1;
      let current = null;
      while (!cancelled_ref.current) {
        const response = await poll_job_with_retry(job_id, known_percent);
        current = response.data;
        setJob(current);
        known_percent = current.percent;
        if (current.status !== "running") break;
      }
      if (current && current.status === "completed") {
        setResult({ approvers: current.approvers === null || current.approvers === undefined ? current.saved : current.approvers });
        showSuccess(translate("DCS_TEST_APPROVALS_SAVED_TO_FORM", { count: current.saved }));
        if (onRefreshForm) onRefreshForm();
      } else if (current && current.status === "error") {
        showError(current.error || translate("DCS_ERROR_GENERIC"));
      } else if (!cancelled_ref.current) {
        showError(translate("DCS_ERROR_GENERIC"));
      }
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setBusy(false);
    }
  };

  const STEPS = [
    { step: 1, label: translate("DCS_APPROVAL_STEP_CONDITIONS") },
    { step: 2, label: translate("DCS_APPROVAL_STEP_ORDER") },
  ];

  return (
    <TestOverlay titleKey="DCS_TEST_APPROVALS_TITLE" onClose={onClose} busy={busy}>
      {condition_fields.length === 0 ? (
        <p className="text-sm" style={LABEL_STYLE}>
          {translate("DCS_TEST_APPROVALS_NO_CASCADING_FIELDS")}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-1">
            {STEPS.map((entry, index) => {
              const active = wizard_step === entry.step;
              const done = wizard_step > entry.step;
              return (
                <div key={entry.step} className="flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setWizardStep(entry.step === 2 && !conditions_valid ? wizard_step : entry.step)}
                    className="flex flex-col items-center gap-1 cursor-pointer"
                    style={{ background: "none", border: "none" }}
                  >
                    <span
                      className="w-7 h-7 flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: done ? SUCCESS : active ? PRIMARY : BORDER, color: done || active ? WHITE : GRAY, borderRadius: "50%", fontFamily: FONT }}
                    >
                      {entry.step}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: done ? SUCCESS : active ? PRIMARY : GRAY, fontFamily: FONT }}>
                      {entry.label}
                    </span>
                  </button>
                  {index < STEPS.length - 1 && <div className="h-0.5 w-8 mx-1 mb-4" style={{ backgroundColor: wizard_step > entry.step ? SUCCESS : BORDER }} />}
                </div>
              );
            })}
          </div>

          {wizard_step === 1 && (
            <div className="space-y-3">
              <p className="text-xs" style={MUTED_STYLE}>
                {translate("DCS_TEST_APPROVALS_CONDITIONS_HINT")}
              </p>
              {condition_rows.map((row, row_index) => (
                <div key={row_index} className="grid grid-cols-[auto_1fr_auto] gap-2 items-center p-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold shrink-0"
                    style={{ backgroundColor: row.field_id ? PRIMARY : BORDER, color: row.field_id ? WHITE : GRAY, borderRadius: "50%", fontFamily: FONT }}
                  >
                    {row_index + 1}
                  </span>
                  <div className="min-w-0">
                    <select
                      value={row.field_id}
                      disabled={busy}
                      onChange={(event) => change_row_field(row_index, event.target.value)}
                      className="cok-auth-input w-full py-2 text-sm min-w-0"
                    >
                      <option value="">{translate("DCS_APPROVAL_CONDITION_FIELD")}</option>
                      {condition_fields
                        .filter((entry) => entry.id === row.field_id || !condition_rows.some((other, other_index) => other_index !== row_index && other.field_id === entry.id))
                        .map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {label_of(entry.id)}
                          </option>
                        ))}
                    </select>
                    {row.field_id && ancestor_fields_of(row.field_id).length > 0 && (
                      <p className="mt-1 text-xs font-semibold truncate" style={{ color: PRIMARY, fontFamily: FONT }} title={group_trail_label(row.field_id)}>
                        {group_trail_label(row.field_id)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove_row(row_index)}
                    className="text-xs font-semibold cursor-pointer shrink-0"
                    style={{ color: DANGER, background: "none", border: "none", fontFamily: FONT }}
                  >
                    {translate("DCS_BTN_DELETE")}
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={add_row}
                className="w-full py-2 text-sm font-semibold cursor-pointer"
                style={{ color: PRIMARY, border: `1px dashed ${PRIMARY}`, backgroundColor: WHITE, fontFamily: FONT }}
              >
                {translate("DCS_APPROVAL_CONDITION_ADD")}
              </button>
              {show_step_error && !conditions_valid && (
                <p className="text-xs" style={{ color: DANGER, fontFamily: FONT }}>
                  {translate("DCS_APPROVAL_STEP_INCOMPLETE")}
                </p>
              )}
              <DcsButtonPrimary className="w-full" onClick={go_next} disabled={busy}>
                {translate("DCS_APPROVAL_NEXT")}
              </DcsButtonPrimary>
            </div>
          )}

          {wizard_step === 2 && (
            <div className="space-y-4">
              <p className="text-xs" style={MUTED_STYLE}>
                {translate("DCS_APPROVAL_GROUP_DRAG_HINT")}
              </p>
              {grouped_cascade_rows().map((chain_entries, chain_row_index) => (
                <div
                  key={chain_entries[0].row.field_id + String(chain_row_index)}
                  className="flex flex-nowrap items-stretch overflow-x-auto pb-2"
                  style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "thin" }}
                >
                  {chain_entries.map((entry, position) => (
                    <React.Fragment key={entry.row.field_id}>
                      {position > 0 && <div className="h-0.5 w-4 shrink-0 self-center" style={{ backgroundColor: BORDER }} />}
                      <div className="p-3 space-y-2 shrink-0 w-52" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold shrink-0"
                            style={{ backgroundColor: PRIMARY, color: WHITE, borderRadius: "50%", fontFamily: FONT }}
                          >
                            {position + 1}
                          </span>
                          <p className="text-sm font-bold truncate" style={LABEL_STYLE} title={group_trail_label(entry.row.field_id)}>
                            {group_trail_label(entry.row.field_id)}
                          </p>
                        </div>
                        <div>
                          <label className="cok-auth-label" style={{ fontSize: 10 }}>
                            {translate("DCS_APPROVAL_FORCE_LABEL")}
                          </label>
                          <select
                            value={entry.row.force === false ? "off" : "on"}
                            disabled={busy}
                            onChange={(event) => set_row_rule(entry.index, "force", event.target.value === "on")}
                            className="cok-auth-input w-full py-1.5 text-xs"
                          >
                            <option value="on">{translate("DCS_APPROVAL_FORCE_ON")}</option>
                            <option value="off">{translate("DCS_APPROVAL_FORCE_OFF")}</option>
                          </select>
                        </div>
                        <div>
                          <label className="cok-auth-label" style={{ fontSize: 10 }}>
                            {translate("DCS_APPROVAL_ON_REJECT_LABEL")}
                          </label>
                          <select
                            value={entry.row.on_reject || "stop"}
                            disabled={busy}
                            onChange={(event) => set_row_rule(entry.index, "on_reject", event.target.value)}
                            className="cok-auth-input w-full py-1.5 text-xs"
                          >
                            <option value="stop">{translate("DCS_APPROVAL_ON_REJECT_STOP")}</option>
                            <option value="continue">{translate("DCS_APPROVAL_ON_REJECT_CONTINUE")}</option>
                          </select>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={busy || position === 0}
                            onClick={() => swap_rows(entry.index, chain_entries[position - 1].index)}
                            className="cok-btn-outlined flex-1"
                            style={{ padding: "0.2rem 0.4rem", fontSize: 11 }}
                          >
                            {translate("DCS_BTN_PREVIOUS")}
                          </button>
                          <button
                            type="button"
                            disabled={busy || position === chain_entries.length - 1}
                            onClick={() => swap_rows(entry.index, chain_entries[position + 1].index)}
                            className="cok-btn-outlined flex-1"
                            style={{ padding: "0.2rem 0.4rem", fontSize: 11 }}
                          >
                            {translate("DCS_BTN_NEXT")}
                          </button>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              ))}
              {(busy || job) && <JobProgress job={job} />}

              {result && (
                <p className="text-sm" style={{ color: SUCCESS, fontFamily: FONT }}>
                  {`${translate("DCS_TEST_APPROVALS_POOL_RESULT", { count: result.approvers })} ${translate("DCS_TEST_APPROVALS_SAVED_TO_FORM", { count: result.approvers })}`}
                </p>
              )}
              <div className="flex gap-3">
                <DcsButtonOutline className="flex-1" onClick={() => setWizardStep(1)} disabled={busy}>
                  {translate("DCS_APPROVAL_BACK")}
                </DcsButtonOutline>
                {busy ? (
                  <div className="flex-1 flex items-center justify-center">
                    <span className="dcs-inline-spinner" style={{ color: PRIMARY }} />
                  </div>
                ) : (
                  <DcsButtonPrimary className="flex-1" onClick={handle_generate}>
                    {translate("DCS_TEST_APPROVALS_GENERATE_CONFIRM_BTN")}
                  </DcsButtonPrimary>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </TestOverlay>
  );
}

function ClearTestApprovalsOverlay({ formGroupId, onRefreshForm, onClose }) {
  const { translate } = useDcsLanguage();
  const { showError, showSuccess } = useToast();
  const [busy, setBusy] = useState(false);

  const handle_clear = async () => {
    setBusy(true);
    try {
      const response = await clear_test_approvals(formGroupId);
      showSuccess(translate("DCS_TEST_APPROVALS_CLEARED_RESULT", { count: response.data.cleared }));
      if (onRefreshForm) onRefreshForm();
      onClose();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <TestOverlay titleKey="DCS_TEST_APPROVALS_CLEAR_TITLE" onClose={onClose} busy={busy}>
      <div className="space-y-4">
        <p className="text-sm" style={LABEL_STYLE}>
          {translate("DCS_TEST_APPROVALS_CLEAR_MESSAGE")}
        </p>
        {busy ? (
          <div className="flex items-center justify-center">
            <span className="dcs-inline-spinner" style={{ color: PRIMARY }} />
          </div>
        ) : (
          <div className="flex gap-3">
            <DcsButtonOutline className="flex-1" onClick={onClose}>
              {translate("DCS_NO")}
            </DcsButtonOutline>
            <DcsButtonOutlineDanger className="flex-1" onClick={handle_clear}>
              {translate("DCS_TEST_APPROVALS_CLEAR_CONFIRM_BTN")}
            </DcsButtonOutlineDanger>
          </div>
        )}
      </div>
    </TestOverlay>
  );
}

export default function DcsTestDataManager({ formGroupId, form, refreshForm }) {
  const { translate } = useDcsLanguage();
  const { showError } = useToast();
  const [open_overlay, setOpenOverlay] = useState(null);
  const [versions, setVersions] = useState([]);
  const [versions_loading, setVersionsLoading] = useState(true);

  useEffect(() => {
    let is_mounted = true;
    setVersionsLoading(true);
    get_form_versions(formGroupId)
      .then((response) => {
        if (is_mounted) setVersions(response.data || []);
      })
      .catch((error) => showError(error.message || translate("DCS_ERROR_GENERIC")))
      .finally(() => is_mounted && setVersionsLoading(false));
    return () => {
      is_mounted = false;
    };
  }, [formGroupId]);

  return (
    <div className="bg-white border-2" style={{ borderColor: BORDER }}>
      <div className="px-4 sm:px-6 py-4" style={{ backgroundColor: PRIMARY }}>
        <p className="text-base font-extrabold uppercase leading-tight" style={{ color: WHITE, fontFamily: FONT, letterSpacing: "-0.5px" }}>
          {translate("DCS_TEST_DATA_LINK")}
        </p>
      </div>
      <div className="p-4 sm:p-6 flex flex-wrap gap-3">
        <DcsButtonOutline style={{ width: "auto" }} onClick={() => setOpenOverlay("generate")}>
          {translate("DCS_TEST_DATA_GENERATE_BTN")}
        </DcsButtonOutline>
        <DcsButtonOutlineDanger style={{ width: "auto" }} onClick={() => setOpenOverlay("delete")}>
          {translate("DCS_TEST_DATA_DELETE_BTN")}
        </DcsButtonOutlineDanger>
        <DcsButtonOutline style={{ width: "auto" }} onClick={() => setOpenOverlay("approvals")}>
          {translate("DCS_TEST_APPROVALS_GENERATE_BTN")}
        </DcsButtonOutline>
        <DcsButtonOutlineDanger style={{ width: "auto" }} onClick={() => setOpenOverlay("clear")}>
          {translate("DCS_TEST_APPROVALS_CLEAR_BTN")}
        </DcsButtonOutlineDanger>
      </div>

      {open_overlay === "generate" && (
        <GenerateTestDataOverlay formGroupId={formGroupId} versions={versions} versionsLoading={versions_loading} onClose={() => setOpenOverlay(null)} />
      )}
      {open_overlay === "delete" && (
        <DeleteTestDataOverlay formGroupId={formGroupId} versions={versions} versionsLoading={versions_loading} onClose={() => setOpenOverlay(null)} />
      )}
      {open_overlay === "approvals" && (
        <GenerateTestApprovalsOverlay formGroupId={formGroupId} form={form} onRefreshForm={refreshForm} onClose={() => setOpenOverlay(null)} />
      )}
      {open_overlay === "clear" && <ClearTestApprovalsOverlay formGroupId={formGroupId} onRefreshForm={refreshForm} onClose={() => setOpenOverlay(null)} />}
    </div>
  );
}
