import React, { useState, useEffect, useRef, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { update_form, get_form_field_options, get_form_approvers } from "../services/formsService.js";
import { useLazyFieldResolvers } from "../hooks/useLazyFieldResolvers.js";
import ApprovalFlowSection from "../builder/ApprovalFlowSection.jsx";
import { build_cascading_chains } from "../builder/cascadingChains.js";
import { validate_form_schema } from "../builder/validateSchema.js";
import { get_field_text } from "../fields/fieldText.js";

const PAGE_SIZE = 20;
const FONT = "'Montserrat', sans-serif";

const FIELDS_LOCK_CSS = `
.dcs-approval-fields-locked input,
.dcs-approval-fields-locked textarea,
.dcs-approval-fields-locked select {
  pointer-events: none;
  opacity: 0.65;
}
.dcs-approval-fields-locked .dcs-approval-header-controls input,
.dcs-approval-fields-locked .dcs-approval-header-controls select,
.dcs-approval-fields-locked .dcs-approval-header-controls button {
  pointer-events: auto;
  opacity: 1;
}
.dcs-approval-hdr-ctl {
  height: 30px;
  font-size: 12px;
  font-family: 'Montserrat', sans-serif;
  color: rgba(255, 255, 255, 0.85);
  background-color: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
  padding: 0 0.55rem;
  outline: none;
  transition: background-color 200ms ease, border-color 200ms ease, color 200ms ease, transform 150ms ease;
}
.dcs-approval-hdr-ctl:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.5);
  color: #FFFFFF;
}
.dcs-approval-hdr-ctl:focus {
  background-color: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.85);
  color: #FFFFFF;
}
button.dcs-approval-hdr-ctl {
  font-weight: 700;
  cursor: pointer;
}
button.dcs-approval-hdr-ctl:active:not(:disabled) {
  transform: scale(0.95);
}
button.dcs-approval-hdr-ctl:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dcs-approval-hdr-select {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  max-width: 200px;
  cursor: pointer;
}
.dcs-approval-hdr-chevron {
  flex-shrink: 0;
  transition: transform 220ms cubic-bezier(0.2, 0, 0, 1);
}
.dcs-approval-hdr-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 60;
  min-width: 190px;
  max-height: 260px;
  overflow-y: auto;
  background-color: #FFFFFF;
  border: 1px solid #E0E0E0;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.18);
  animation: dcsHdrMenuIn 180ms cubic-bezier(0.2, 0, 0, 1);
}
@keyframes dcsHdrMenuIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}
.dcs-approval-hdr-option {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.75rem;
  font-size: 12px;
  font-family: 'Montserrat', sans-serif;
  color: #333333;
  background-color: #FFFFFF;
  border: none;
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease, padding-left 140ms ease;
}
.dcs-approval-hdr-option:hover {
  background-color: #F0F7FC;
  color: #056daa;
  padding-left: 0.95rem;
}
.dcs-approval-hdr-option.is-selected {
  color: #056daa;
  font-weight: 700;
}
input.dcs-approval-hdr-ctl::placeholder {
  color: rgba(255, 255, 255, 0.65);
}
input.dcs-approval-hdr-ctl::-webkit-outer-spin-button,
input.dcs-approval-hdr-ctl::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input.dcs-approval-hdr-ctl[type=number] {
  -moz-appearance: textfield;
}
`;

function HeaderDropdown({ value, placeholder, options, onChange, title }) {
  const [open, setOpen] = useState(false);
  const container_ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handle_outside = (event) => {
      if (container_ref.current && !container_ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handle_outside);
    return () => document.removeEventListener("mousedown", handle_outside);
  }, [open]);

  const selected = options.find((option) => option.value === value);

  return (
    <div ref={container_ref} className="relative" title={title}>
      <button type="button" className="dcs-approval-hdr-ctl dcs-approval-hdr-select" onClick={() => setOpen((previous) => !previous)}>
        <span className="truncate">{selected && selected.value !== "" ? selected.label : placeholder}</span>
        <svg className="dcs-approval-hdr-chevron" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }} width="10" height="6" viewBox="0 0 10 6">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="dcs-approval-hdr-menu">
          {options.map((option) => (
            <button
              key={option.value || "__all__"}
              type="button"
              className={`dcs-approval-hdr-option${option.value === value ? " is-selected" : ""}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FormApprovalPage() {
  const { form_group_id, form, refreshForm } = useOutletContext();
  const { translate, language } = useDcsLanguage();
  const { showSuccess, showError } = useToast();
  const [approval_config, setApprovalConfig] = useState(null);
  const [load_state, setLoadState] = useState({ status: "idle", loaded: 0, total: null });
  const [schema_errors, setSchemaErrors] = useState([]);
  const { resolveFullFieldOptions } = useLazyFieldResolvers("form", form_group_id, get_form_field_options);
  const [is_dirty, setIsDirty] = useState(false);
  const [filter_from, setFilterFrom] = useState("");
  const [filter_to, setFilterTo] = useState("");
  const [load_count_input, setLoadCountInput] = useState("");
  const loaded_approvers_ref = useRef([]);
  const seen_keys_ref = useRef(new Set());
  const next_page_ref = useRef(1);
  const run_seq_ref = useRef(0);

  const chains = React.useMemo(() => build_cascading_chains(form.schema.fields || []), [form]);
  const chain_of_field = React.useMemo(() => {
    const map = new Map();
    chains.forEach((chain) => chain.levels.forEach((level, depth) => map.set(level.id, { chain, depth })));
    return map;
  }, [chains]);

  const level_label = (field) => get_field_text(field.label, language) || field.id;

  const active_group_fields = React.useMemo(() => {
    const from_entry = chain_of_field.get(filter_from);
    if (!from_entry) return [];
    const to_entry = chain_of_field.get(filter_to);
    const same_chain = to_entry && to_entry.chain === from_entry.chain;
    const start = same_chain ? Math.min(from_entry.depth, to_entry.depth) : from_entry.depth;
    const end = same_chain ? Math.max(from_entry.depth, to_entry.depth) : from_entry.chain.levels.length - 1;
    return from_entry.chain.levels.slice(start, end + 1).map((level) => level.id);
  }, [filter_from, filter_to, chain_of_field]);

  const reset_loaded = () => {
    loaded_approvers_ref.current = [];
    seen_keys_ref.current = new Set();
    next_page_ref.current = 1;
  };

  /**
   * Loads up to records_wanted more approvers, 20 by 20, starting exactly
   * from what is already loaded - never automatically to the end.
   */
  const load_more = useCallback(
    async (records_wanted) => {
      const run_id = run_seq_ref.current + 1;
      run_seq_ref.current = run_id;
      const is_stale = () => run_seq_ref.current !== run_id;
      const wanted = Math.max(1, records_wanted || PAGE_SIZE);
      const target = loaded_approvers_ref.current.length + wanted;

      setLoadState((previous) => ({ status: "loading", loaded: loaded_approvers_ref.current.length, total: previous.total }));
      try {
        let enabled = false;
        let mode;
        let total = null;
        while (!is_stale()) {
          const response = await get_form_approvers(form_group_id, next_page_ref.current, PAGE_SIZE, active_group_fields);
          if (is_stale()) return;
          enabled = response.data.enabled;
          mode = response.data.mode;
          total = response.data.total;
          const page_approvers = response.data.approvers || [];
          next_page_ref.current += 1;
          page_approvers.forEach((approver) => {
            const key = JSON.stringify(approver);
            if (seen_keys_ref.current.has(key)) return;
            seen_keys_ref.current.add(key);
            loaded_approvers_ref.current.push(approver);
          });
          setApprovalConfig({ enabled, mode, approvers: [...loaded_approvers_ref.current] });
          setLoadState({ status: "loading", loaded: loaded_approvers_ref.current.length, total });
          const fetched_so_far = (next_page_ref.current - 1) * PAGE_SIZE;
          if (fetched_so_far >= total || page_approvers.length === 0 || loaded_approvers_ref.current.length >= target) break;
        }
        if (is_stale()) return;
        setLoadState({ status: "idle", loaded: loaded_approvers_ref.current.length, total });
      } catch (error) {
        if (is_stale()) return;
        setLoadState((previous) => ({ status: "failed", loaded: loaded_approvers_ref.current.length, total: previous.total }));
        showError(error.message || translate("DCS_ERROR_GENERIC"));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form_group_id, active_group_fields],
  );

  useEffect(() => {
    reset_loaded();
    setApprovalConfig(null);
    setIsDirty(false);
    load_more(PAGE_SIZE);
    return () => {
      run_seq_ref.current += 1;
    };
  }, [form_group_id, load_more]);

  const handle_save_approvers = async (config) => {
    const frontend_check = validate_form_schema({ fields: form.schema.fields });
    if (!frontend_check.valid) {
      setSchemaErrors(frontend_check.errors);
      showError(translate("DCS_SCHEMA_ERROR_BANNER"));
      return;
    }
    try {
      const response = await update_form(form_group_id, form.form_name || "", { fields: form.schema.fields }, config);
      showSuccess(response.message || translate("DCS_APPROVAL_SAVED"));
      refreshForm();
    } catch (error) {
      showError(error.message || translate("DCS_ERROR_GENERIC"));
    }
  };

  const is_fully_loaded =
    load_state.total !== null && load_state.loaded >= load_state.total && active_group_fields.length === 0 && load_state.status === "idle";
  const has_more = load_state.total === null || load_state.loaded < load_state.total;
  const is_loading = load_state.status === "loading";

  const handle_load_count = () => {
    const wanted = parseInt(load_count_input, 10);
    if (!Number.isFinite(wanted) || wanted < 1) {
      load_more(PAGE_SIZE);
      return;
    }
    setLoadCountInput("");
    load_more(wanted);
  };

  const header_controls = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="text-xs whitespace-nowrap" style={{ color: "rgba(255,255,255,0.85)", fontFamily: FONT }}>
        {translate("DCS_APPROVAL_LOADED_COUNT", { loaded: load_state.loaded, total: load_state.total === null ? "?" : load_state.total })}
      </span>
      {chains.length > 0 && (
        <>
          <HeaderDropdown
            value={filter_from}
            placeholder={translate("DCS_APPROVAL_FILTER_ALL")}
            title={translate("DCS_APPROVAL_FILTER_FROM")}
            onChange={(next_value) => {
              setFilterFrom(next_value);
              setFilterTo("");
            }}
            options={[{ value: "", label: translate("DCS_APPROVAL_FILTER_ALL") }].concat(
              chains.flatMap((chain) =>
                chain.levels.map((level) => ({
                  value: level.id,
                  label: `${translate("DCS_APPROVAL_FILTER_FROM")}: ${level_label(level)}`,
                })),
              ),
            )}
          />
          {filter_from && chain_of_field.get(filter_from) && (
            <HeaderDropdown
              value={filter_to}
              placeholder={`${translate("DCS_APPROVAL_FILTER_TO")}...`}
              title={translate("DCS_APPROVAL_FILTER_TO")}
              onChange={setFilterTo}
              options={[{ value: "", label: `${translate("DCS_APPROVAL_FILTER_TO")}...` }].concat(
                chain_of_field
                  .get(filter_from)
                  .chain.levels.slice(chain_of_field.get(filter_from).depth)
                  .map((level) => ({
                    value: level.id,
                    label: `${translate("DCS_APPROVAL_FILTER_TO")}: ${level_label(level)}`,
                  })),
              )}
            />
          )}
        </>
      )}
      {has_more && (
        <>
          <button type="button" disabled={is_loading} onClick={() => load_more(PAGE_SIZE)} className="dcs-approval-hdr-ctl">
            {translate("DCS_BTN_LOAD_MORE")}
          </button>
          <input
            type="number"
            min="1"
            value={load_count_input}
            disabled={is_loading}
            placeholder={translate("DCS_APPROVAL_LOAD_COUNT_PLACEHOLDER")}
            onChange={(event) => setLoadCountInput(event.target.value)}
            className="dcs-approval-hdr-ctl"
            style={{ width: 90 }}
          />
          <button type="button" disabled={is_loading} onClick={handle_load_count} className="dcs-approval-hdr-ctl">
            {translate("DCS_APPROVAL_LOAD_BTN")}
          </button>
        </>
      )}
      {is_loading && <span className="dcs-inline-spinner" style={{ color: "#FFFFFF" }} />}
    </div>
  );

  return (
    <div className="space-y-4 pb-16 w-full">
      <style>{FIELDS_LOCK_CSS}</style>
      <div className="bg-white border-2 w-full" style={{ borderColor: "#E0E0E0" }}>
        {approval_config === null ? (
          <div className="flex flex-col items-center gap-3 py-8">
            {load_state.status !== "failed" && <span className="dcs-inline-spinner" style={{ color: "#056daa" }} />}
            <p className="text-sm font-semibold" style={{ color: load_state.status === "failed" ? "#E74C3C" : "#056daa", fontFamily: FONT }}>
              {load_state.status === "failed"
                ? translate("DCS_APPROVAL_LOAD_FAILED")
                : translate("DCS_APPROVAL_LOADING_APPROVERS", { loaded: 0, total: "?" })}
            </p>
            {load_state.status === "failed" && (
              <button type="button" onClick={() => load_more(PAGE_SIZE)} className="cok-btn-outlined" style={{ fontFamily: FONT, cursor: "pointer" }}>
                {translate("DCS_BTN_LOAD_MORE")}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className={is_fully_loaded ? undefined : "dcs-approval-fields-locked"}>
              <ApprovalFlowSection
                value={approval_config}
                onChange={setApprovalConfig}
                fields={form.schema.fields}
                onSave={handle_save_approvers}
                resolveFullFieldOptions={resolveFullFieldOptions}
                onDirtyChange={setIsDirty}
                headerExtra={header_controls}
                saveDisabled={!is_fully_loaded}
                flush
              />
            </div>

            {(is_loading || load_state.status === "failed" || has_more) && (
              <div className="flex flex-col items-center gap-2 pt-4 mt-4 px-4 pb-4" style={{ borderTop: "1px solid #E0E0E0" }}>
                {is_loading && <span className="dcs-inline-spinner" style={{ color: "#056daa" }} />}
                <p className="text-sm font-semibold" style={{ color: load_state.status === "failed" ? "#E74C3C" : "#056daa", fontFamily: FONT }}>
                  {load_state.status === "failed"
                    ? translate("DCS_APPROVAL_LOAD_FAILED")
                    : translate("DCS_APPROVAL_LOADED_COUNT", {
                        loaded: load_state.loaded,
                        total: load_state.total === null ? "?" : load_state.total,
                      })}
                </p>
                {load_state.total !== null && load_state.total > 0 && (
                  <div className="w-full" style={{ maxWidth: 360, height: 8, backgroundColor: "#E0E0E0" }}>
                    <div
                      style={{
                        height: 8,
                        width: `${Math.min(100, Math.round((load_state.loaded / Math.max(1, load_state.total)) * 100))}%`,
                        backgroundColor: "#056daa",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                )}
                {!is_loading && has_more && (
                  <button type="button" onClick={() => load_more(PAGE_SIZE)} className="cok-btn-outlined" style={{ fontFamily: FONT, cursor: "pointer" }}>
                    {translate("DCS_BTN_LOAD_MORE")}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
