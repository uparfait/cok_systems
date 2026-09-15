import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_field_text } from "../fields/fieldText.js";
import { preset_parent_id, child_options_for_parent, flatten_field_options } from "../fields/presetFields.js";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";

const CHOICE_TYPES = ["single_select", "select_group", "cascading_select"];
const MULTI_TYPES = ["multi_select", "ranking"];
const INPUT_TYPES = { number: "number", date: "date", date_time: "datetime-local", time: "time" };
const EMPTY_CONFIG = { enabled: false, mode: "constant", value: null, parent_field_id: null, by_parent: {} };

const is_api_sourced = (field) => !!(field && field.data_source && field.data_source.type === "api");
const option_text = (option) => get_field_text(option.label, "en") || String(option.value);

/**
 * One default-value editor shaped by the field's type: a dropdown of the
 * field's own options (or the options under one parent answer), a
 * checkbox list for multi-value fields, a numbered pick for a likert
 * scale, and a typed input otherwise. API-sourced locations have no inline
 * options, so their default is typed as the stored location name.
 */
function DefaultValueInput({ field, options, value, onChange }) {
  const { translate } = useDcsLanguage();
  if (CHOICE_TYPES.includes(field.type) && !is_api_sourced(field) && options.length > 0) {
    return (
      <select className="cok-auth-input w-full py-2" value={value === undefined || value === null ? "" : String(value)} onChange={(event) => onChange(event.target.value || null)}>
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
      <select className="cok-auth-input w-full py-2" value={value === undefined || value === null ? "" : String(value)} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}>
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
      <input type={INPUT_TYPES[field.type] || "text"} className="cok-auth-input w-full py-2" value={value === undefined || value === null ? "" : value} onChange={(event) => onChange(event.target.value === "" ? null : field.type === "number" ? Number(event.target.value) : event.target.value)} />
      {(is_api_sourced(field) || CHOICE_TYPES.includes(field.type)) && (
        <p className="text-xs mt-1" style={{ color: "#9E9E9E" }}>
          {translate("DCS_DEFAULT_FREE_TEXT_HINT")}
        </p>
      )}
    </div>
  );
}

/**
 * The "Default value" tab of a data-collection field: switch the preset
 * on, choose whether it is one constant value or decided by another
 * field's answer, and pick the value(s). A preset field is hidden from
 * respondents and always submitted with its default.
 */
export default function DefaultValueTab({ draft, update, otherFields }) {
  const { translate } = useDcsLanguage();
  const config = Object.assign({}, EMPTY_CONFIG, draft.default_config || {});
  const set = (patch) => update({ default_config: Object.assign({}, config, patch) });
  const [new_key, setNewKey] = useState("");

  const parent_id = config.parent_field_id || preset_parent_id(draft) || "";
  const parent = (otherFields || []).find((field) => field.id === parent_id) || null;
  const parent_label = parent ? get_field_text(parent.label, "en") || parent.id : "";
  const parent_options = parent && !is_api_sourced(parent) ? flatten_field_options(parent) : [];
  const mapped_keys = Object.keys(config.by_parent || {});
  const keys = parent_options.length > 0 ? parent_options.map((option) => String(option.value)) : mapped_keys;
  const all_options = flatten_field_options(draft);

  const set_mapping = (key, value) => {
    const next = Object.assign({}, config.by_parent || {});
    if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) delete next[key];
    else next[key] = value;
    set({ by_parent: next });
  };

  const summary = !config.enabled
    ? ""
    : config.mode === "constant"
      ? config.value !== null && config.value !== undefined && config.value !== ""
        ? translate("DCS_DEFAULT_SUMMARY_CONSTANT", { value: Array.isArray(config.value) ? config.value.join(", ") : String(config.value) })
        : ""
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
              <DefaultValueInput field={draft} options={all_options} value={config.value} onChange={(value) => set({ value })} />
            </div>
          )}

          {config.mode === "by_parent" && (
            <div className="space-y-3">
              <div>
                <label className="cok-auth-label">{translate("DCS_DEFAULT_PARENT")}</label>
                <select className="cok-auth-input w-full py-2" value={parent_id} onChange={(event) => set({ parent_field_id: event.target.value || null, by_parent: {} })}>
                  <option value="">{translate("DCS_RENDERER_SELECT_PLACEHOLDER")}</option>
                  {(otherFields || []).map((field) => (
                    <option key={field.id} value={field.id}>
                      {get_field_text(field.label, "en") || field.id}
                    </option>
                  ))}
                </select>
              </div>

              {parent && (
                <div className="space-y-2">
                  {keys.map((key) => (
                    <div key={key} className="border p-3 space-y-1" style={{ borderColor: config.by_parent && config.by_parent[key] !== undefined ? "rgba(5,109,170,0.45)" : "#E0E0E0" }}>
                      <p className="text-xs font-semibold" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
                        {translate("DCS_DEFAULT_WHEN_PARENT_IS", { parent: parent_label })} <span style={{ color: "#056daa" }}>{key}</span> {translate("DCS_DEFAULT_THEN")}
                      </p>
                      <DefaultValueInput field={draft} options={child_options_for_parent(draft, key)} value={config.by_parent ? config.by_parent[key] : undefined} onChange={(value) => set_mapping(key, value)} />
                      {parent_options.length === 0 && (
                        <button type="button" className="text-xs font-semibold cursor-pointer" style={{ color: "#E74C3C", background: "none", border: "none", padding: 0 }} onClick={() => set_mapping(key, null)}>
                          {translate("DCS_SETTINGS_REMOVE")}
                        </button>
                      )}
                    </div>
                  ))}
                  {parent_options.length === 0 && (
                    <div className="flex gap-2">
                      <input className="cok-auth-input flex-1 py-2" placeholder={translate("DCS_DEFAULT_PARENT_VALUE_PLACEHOLDER")} value={new_key} onChange={(event) => setNewKey(event.target.value)} />
                      <DcsButtonOutline
                        disabled={!new_key.trim()}
                        onClick={() => {
                          set({ by_parent: Object.assign({}, config.by_parent || {}, { [new_key.trim()]: config.by_parent && config.by_parent[new_key.trim()] !== undefined ? config.by_parent[new_key.trim()] : "" }) });
                          setNewKey("");
                        }}
                      >
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
