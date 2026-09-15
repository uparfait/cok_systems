import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_field_text } from "../fields/fieldText.js";
import { preset_parent_id, child_options_for_parent, flatten_field_options } from "../fields/presetFields.js";
import { is_api_location_field, useLocationOptions } from "../fields/locationOptions.js";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DefaultLocationSelect from "./DefaultLocationSelect.jsx";

const CHOICE_TYPES = ["single_select", "select_group", "cascading_select"];
const MULTI_TYPES = ["multi_select", "ranking"];
const INPUT_TYPES = { number: "number", date: "date", date_time: "datetime-local", time: "time" };
const EMPTY_CONFIG = { enabled: false, mode: "constant", value: null, parent_field_id: null, by_parent: {} };
// Above this many parent answers the editor lists only the mapped ones.
const MAX_INLINE_KEYS = 40;

const option_text = (option) => (typeof option.label === "string" ? option.label : get_field_text(option.label, "en")) || String(option.value);
const is_blank = (value) => value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

/** The constant preset another field carries, if any - it narrows a location list to what that answer allows. */
function constant_preset(field) {
  const config = field && field.default_config;
  if (!config || !config.enabled || config.mode !== "constant" || is_blank(config.value)) return undefined;
  return config.value;
}

/**
 * One default-value editor shaped by the field's type: real locations
 * fetched for an API-sourced field, a dropdown of the field's own options
 * (or the options under one parent answer), a checkbox list for
 * multi-value fields, a numbered pick for a likert scale, and a typed
 * input otherwise.
 */
function DefaultValueInput({ field, options, value, onChange, ancestor }) {
  const { translate } = useDcsLanguage();
  if (is_api_location_field(field)) return <DefaultLocationSelect field={field} ancestor={ancestor} value={value} onChange={onChange} />;
  if (CHOICE_TYPES.includes(field.type) && options.length > 0) {
    return (
      <select className="cok-auth-input w-full py-2" value={is_blank(value) ? "" : String(value)} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">{translate("DCS_DEFAULT_PICK")}</option>
        {options.map((option) => (
          <option key={option.id || option.value} value={option.value}>
            {option_text(option)}
          </option>
        ))}
      </select>
    );
  }
  if (MULTI_TYPES.includes(field.type) && options.length > 0) {
    const chosen = Array.isArray(value) ? value.map(String) : [];
    return (
      <div className="flex flex-col gap-1 border p-2" style={{ borderColor: "#E0E0E0", maxHeight: 180, overflowY: "auto" }}>
        {options.map((option) => {
          const key = String(option.value);
          const checked = chosen.includes(key);
          return (
            <label key={option.id || key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={checked} style={{ accentColor: "#056daa" }} onChange={() => onChange(checked ? chosen.filter((entry) => entry !== key) : chosen.concat([key]))} />
              {option_text(option)}
            </label>
          );
        })}
      </div>
    );
  }
  if (field.type === "likert_scale") {
    const size = Number(field.scale_size) || 5;
    return (
      <select className="cok-auth-input w-full py-2" value={is_blank(value) ? "" : String(value)} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}>
        <option value="">{translate("DCS_DEFAULT_PICK")}</option>
        {Array.from({ length: size }, (_, index) => index + 1).map((step) => (
          <option key={step} value={step}>
            {step}
          </option>
        ))}
      </select>
    );
  }
  return (
    <div>
      <input type={INPUT_TYPES[field.type] || "text"} className="cok-auth-input w-full py-2" value={is_blank(value) ? "" : value} onChange={(event) => onChange(event.target.value === "" ? null : field.type === "number" ? Number(event.target.value) : event.target.value)} />
      {CHOICE_TYPES.includes(field.type) && (
        <p className="text-xs mt-1" style={{ color: "#9E9E9E" }}>
          {translate("DCS_DEFAULT_FREE_TEXT_HINT")}
        </p>
      )}
    </div>
  );
}

/**
 * The answers of the deciding field the by_parent editor keys on: its own
 * options, a lazy field's full options fetched on demand, or every real
 * location of an API-sourced parent's level (under its own preset parent
 * when it has one) - so a key is always picked, never typed, whenever the
 * system knows the answers.
 */
function useParentAnswers(parent, otherFields, resolveFullFieldOptions) {
  const [fetched, setFetched] = useState({ id: null, options: [] });
  const parent_id = parent ? parent.id : null;
  const needs_fetch = !!(parent && parent.lazy_options && flatten_field_options(parent).length === 0 && resolveFullFieldOptions);
  useEffect(() => {
    if (!needs_fetch) return undefined;
    let is_mounted = true;
    resolveFullFieldOptions(parent_id)
      .then((data) => is_mounted && data && setFetched({ id: parent_id, options: flatten_field_options(Object.assign({}, parent, data)) }))
      .catch(() => {});
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needs_fetch, parent_id, resolveFullFieldOptions]);
  const grandparent = parent && parent.parent_field_id ? otherFields.find((field) => field.id === parent.parent_field_id) : null;
  const location = useLocationOptions(parent, constant_preset(grandparent));
  if (!parent) return { options: [], loading: false };
  if (is_api_location_field(parent)) return { options: location.options, loading: location.loading };
  if (needs_fetch) return { options: fetched.id === parent_id ? fetched.options : [], loading: fetched.id !== parent_id };
  return { options: flatten_field_options(parent), loading: false };
}

/**
 * The "Default value" tab of a data-collection field: switch the preset
 * on, choose whether it is one constant value or decided by another
 * field's answer, and pick the value(s). A preset field is hidden from
 * respondents and always submitted with its default.
 */
export default function DefaultValueTab({ draft, update, otherFields, resolveFullFieldOptions }) {
  const { translate } = useDcsLanguage();
  const config = Object.assign({}, EMPTY_CONFIG, draft.default_config || {});
  const set = (patch) => update({ default_config: Object.assign({}, config, patch) });
  const [new_key, setNewKey] = useState("");
  const fields = otherFields || [];

  const parent_id = config.parent_field_id || preset_parent_id(draft) || "";
  const parent = fields.find((field) => field.id === parent_id) || null;
  const parent_label = parent ? get_field_text(parent.label, "en") || parent.id : "";
  const parent_answers = useParentAnswers(parent, fields, resolveFullFieldOptions);
  const parent_options = parent_answers.options;
  const mapped_keys = Object.keys(config.by_parent || {});
  const show_all_keys = parent_options.length > 0 && parent_options.length <= MAX_INLINE_KEYS;
  const keys = show_all_keys ? parent_options.map((option) => String(option.value)) : mapped_keys;
  const unmapped_options = parent_options.filter((option) => !mapped_keys.includes(String(option.value)));
  const key_label = (key) => {
    const option = parent_options.find((entry) => String(entry.value) === key);
    return option ? option_text(option) : key;
  };
  const all_options = flatten_field_options(draft);
  // A location field's list is narrowed to what its own cascade parent
  // already fixes: the parent answer being mapped, or that parent's preset.
  const cascade_parent = draft.parent_field_id ? fields.find((field) => field.id === draft.parent_field_id) : null;
  const constant_ancestor = constant_preset(cascade_parent);
  const ancestor_for = (key) => (parent && cascade_parent && parent.id === cascade_parent.id ? key : constant_ancestor);

  const set_mapping = (key, value) => {
    const next = Object.assign({}, config.by_parent || {});
    if (is_blank(value)) delete next[key];
    else next[key] = value;
    set({ by_parent: next });
  };
  const add_key = (key) => {
    const trimmed = String(key || "").trim();
    if (!trimmed) return;
    set({ by_parent: Object.assign({}, config.by_parent || {}, { [trimmed]: config.by_parent && config.by_parent[trimmed] !== undefined ? config.by_parent[trimmed] : "" }) });
    setNewKey("");
  };

  const summary = !config.enabled
    ? ""
    : config.mode === "constant"
      ? is_blank(config.value)
        ? ""
        : translate("DCS_DEFAULT_SUMMARY_CONSTANT", { value: Array.isArray(config.value) ? config.value.join(", ") : String(config.value) })
      : parent
        ? translate("DCS_DEFAULT_SUMMARY_BY_PARENT", { parent: parent_label })
        : "";

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: "#9E9E9E" }}>
        {translate("DCS_DEFAULT_TAB_INTRO")}
      </p>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={!!config.enabled} style={{ accentColor: "#056daa" }} onChange={(event) => set({ enabled: event.target.checked })} />
        {translate("DCS_DEFAULT_ENABLE")}
      </label>

      {config.enabled && (
        <>
          <div className="flex flex-col gap-2">
            {["constant", "by_parent"].map((mode) => (
              <label key={mode} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="dcs_default_mode" checked={config.mode === mode} style={{ accentColor: "#056daa" }} onChange={() => set({ mode })} />
                {translate(mode === "constant" ? "DCS_DEFAULT_MODE_CONSTANT" : "DCS_DEFAULT_MODE_BY_PARENT")}
              </label>
            ))}
          </div>

          {config.mode === "constant" && (
            <div>
              <label className="cok-auth-label">{translate("DCS_DEFAULT_VALUE")}</label>
              <DefaultValueInput field={draft} options={all_options} value={config.value} onChange={(value) => set({ value })} ancestor={constant_ancestor} />
            </div>
          )}

          {config.mode === "by_parent" && (
            <div className="space-y-3">
              <div>
                <label className="cok-auth-label">{translate("DCS_DEFAULT_PARENT")}</label>
                <select className="cok-auth-input w-full py-2" value={parent_id} onChange={(event) => set({ parent_field_id: event.target.value || null, by_parent: {} })}>
                  <option value="">{translate("DCS_RENDERER_SELECT_PLACEHOLDER")}</option>
                  {fields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {get_field_text(field.label, "en") || field.id}
                    </option>
                  ))}
                </select>
              </div>

              {parent && (
                <div className="space-y-2">
                  {parent_answers.loading && (
                    <p className="text-xs" style={{ color: "#9E9E9E" }}>
                      {translate("DCS_FIELD_OPTIONS_LOADING")}
                    </p>
                  )}
                  {keys.map((key) => (
                    <div key={key} className="border p-3 space-y-1" style={{ borderColor: config.by_parent && config.by_parent[key] !== undefined ? "rgba(5,109,170,0.45)" : "#E0E0E0" }}>
                      <p className="text-xs font-semibold" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
                        {translate("DCS_DEFAULT_WHEN_PARENT_IS", { parent: parent_label })} <span style={{ color: "#056daa" }}>{key_label(key)}</span> {translate("DCS_DEFAULT_THEN")}
                      </p>
                      <DefaultValueInput field={draft} options={child_options_for_parent(draft, key)} value={config.by_parent ? config.by_parent[key] : undefined} onChange={(value) => set_mapping(key, value)} ancestor={ancestor_for(key)} />
                      {!show_all_keys && (
                        <button type="button" className="text-xs font-semibold cursor-pointer" style={{ color: "#E74C3C", background: "none", border: "none", padding: 0 }} onClick={() => set_mapping(key, null)}>
                          {translate("DCS_SETTINGS_REMOVE")}
                        </button>
                      )}
                    </div>
                  ))}
                  {!show_all_keys && parent_options.length > 0 && unmapped_options.length > 0 && (
                    <select className="cok-auth-input w-full py-2" value="" onChange={(event) => add_key(event.target.value)}>
                      <option value="">{translate("DCS_DEFAULT_ADD_MAPPING")}</option>
                      {unmapped_options.map((option) => (
                        <option key={option.id || option.value} value={option.value}>
                          {option_text(option)}
                        </option>
                      ))}
                    </select>
                  )}
                  {!show_all_keys && parent_options.length === 0 && !parent_answers.loading && (
                    <div className="flex gap-2">
                      <input className="cok-auth-input flex-1 py-2" placeholder={translate("DCS_DEFAULT_PARENT_VALUE_PLACEHOLDER")} value={new_key} onChange={(event) => setNewKey(event.target.value)} />
                      <DcsButtonOutline disabled={!new_key.trim()} onClick={() => add_key(new_key)}>
                        {translate("DCS_DEFAULT_ADD_MAPPING")}
                      </DcsButtonOutline>
                    </div>
                  )}
                  <p className="text-xs" style={{ color: "#9E9E9E" }}>
                    {translate("DCS_DEFAULT_NO_MAPPING")}
                  </p>
                </div>
              )}
            </div>
          )}

          {summary && (
            <p className="text-xs px-3 py-2" style={{ backgroundColor: "rgba(5,109,170,0.06)", borderLeft: "3px solid #056daa", color: "#333333" }}>
              {summary}
            </p>
          )}
        </>
      )}
    </div>
  );
}
