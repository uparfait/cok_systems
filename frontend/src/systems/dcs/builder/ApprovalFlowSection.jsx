import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_locations } from "../services/locationsService.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_APPROVERS = 20;

const APPROVER_LEVELS = ["VILLAGE", "CELL", "SECTOR", "DISTRICT", "PROVINCE"];
const LEVELS_TOP_DOWN = ["PROVINCE", "DISTRICT", "SECTOR", "CELL", "VILLAGE"];
// location_id encodes the hierarchy by digit width, so every ancestor is a prefix of the id.
const ID_DIGITS = { PROVINCE: 1, DISTRICT: 2, SECTOR: 4, CELL: 6, VILLAGE: 8 };

// Form field types an approver condition ("field equals value") can target.
const CONDITION_FIELD_TYPES = [
  "text", "large_text", "number", "email", "url", "phone",
  "single_select", "multi_select", "likert_scale",
  "select_group", "cascading_select", "hidden",
  "date", "time", "date_time",
];

const EMPTY_APPROVER = { name: "", role: "", email: "", level: "", location_id: null, location_name: "", conditions: [], force: true, on_reject: "stop" };

// Same input/label styling as the event manager forms (RoomForm & co).
const INPUT_CLASS =
  "w-full px-4 py-2.5 border border-gray-300 ppp-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200";
const LABEL_CLASS = "block text-sm font-medium text-gray-700";

// Client-side mirror of the backend's approval_config validation.
export function is_approval_config_complete(config) {
  if (!config || config.enabled !== true) return true;
  if (!Array.isArray(config.approvers) || config.approvers.length === 0) return false;
  return config.approvers.every((approver) => {
    const base = approver.name.trim() && approver.role.trim() && EMAIL_REGEX.test(approver.email.trim());
    const location_set = approver.location_id !== null && approver.location_id !== undefined && `${approver.location_id}` !== "";
    const location_ok = approver.level ? location_set : true;
    const conditions_ok = (approver.conditions || []).every(
      (condition) => condition.field_id && `${condition.value === undefined || condition.value === null ? "" : condition.value}`.trim(),
    );
    return base && location_ok && conditions_ok;
  });
}

/** Ancestor ids down to `level`, read straight off the id's leading digits. */
function path_from_location_id(location_id, level) {
  const path = {};
  if (location_id === null || location_id === undefined) return path;
  const digits = String(location_id);
  for (const entry of LEVELS_TOP_DOWN) {
    if (digits.length < ID_DIGITS[entry]) break;
    path[entry] = Number(digits.slice(0, ID_DIGITS[entry]));
    if (entry === level) break;
  }
  return path;
}

/** Data fields (groups flattened) a condition can point at. */
function flatten_condition_fields(fields) {
  const flat = [];
  (fields || []).forEach((field) => {
    if (field.type === "group") flat.push(...flatten_condition_fields(field.children));
    else if (CONDITION_FIELD_TYPES.includes(field.type)) flat.push(field);
  });
  return flat;
}

function field_label(field, language) {
  const label = field.label;
  if (label && typeof label === "object") return label[language] || label.en || label.kn || label.fr || field.id;
  return label || field.id;
}

function option_label(option, language) {
  const label = option.label;
  if (label && typeof label === "object") return label[language] || label.en || label.kn || label.fr || String(option.value);
  return label || String(option.value);
}

const options_cache = new Map();

/** One level of the location cascade; fetches (and caches) its own options from /dcs/api/locations. */
function LocationSelect({ level, parent_id, value, onChange, label, placeholder }) {
  const [options, set_options] = useState([]);
  const needs_parent = level !== "PROVINCE";
  const parent_missing = needs_parent && (parent_id === null || parent_id === undefined);

  useEffect(() => {
    if (parent_missing) {
      set_options([]);
      return undefined;
    }
    const cache_key = `${level}:${needs_parent ? parent_id : "root"}`;
    if (options_cache.has(cache_key)) {
      set_options(options_cache.get(cache_key));
      return undefined;
    }
    let cancelled = false;
    get_locations(level, needs_parent ? parent_id : null)
      .then((response) => {
        const list = (response && response.data) || [];
        options_cache.set(cache_key, list);
        if (!cancelled) set_options(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [level, parent_id, needs_parent, parent_missing]);

  return (
    <div className="space-y-1.5">
      <label className={LABEL_CLASS}>
        {label} <span className="text-red-500">*</span>
      </label>
      <select
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(event) => {
          const selected = options.find((option) => String(option.location_id) === event.target.value);
          onChange(selected ? selected.location_id : null, selected ? selected.name : "");
        }}
        disabled={parent_missing}
        className={`${INPUT_CLASS} ${parent_missing ? "bg-gray-100 text-gray-400" : ""}`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.location_id} value={String(option.location_id)}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// Optional pre-publish step: the form owner defines who must approve each submitted response.
// An approver joins a submission's flow when their location (if set) and every field
// condition (if any) match the submitted answers; approvers sign in the order listed here.
export default function ApprovalFlowSection({ value, onChange, fields }) {
  const { translate, language } = useDcsLanguage();
  const enabled = !!value && value.enabled === true;
  const approvers = (value && value.approvers) || [];
  const condition_fields = flatten_condition_fields(fields);
  // Transient cascade picks (per approver index) that don't yet amount to a final location.
  const [draft_paths, set_draft_paths] = useState({});

  const emit = (next) => onChange(next);
  const emit_approvers = (next_approvers) => emit({ enabled: true, approvers: next_approvers });

  const handle_toggle = () => {
    if (enabled) emit(null);
    else emit({ enabled: true, approvers: [Object.assign({}, EMPTY_APPROVER)] });
  };

  const handle_count_change = (raw_count) => {
    const count = Math.max(1, Math.min(MAX_APPROVERS, Number(raw_count) || 1));
    emit_approvers(Array.from({ length: count }, (_, index) => approvers[index] || Object.assign({}, EMPTY_APPROVER)));
  };

  const handle_approver_change = (index, key, field_value) => {
    const next_approvers = approvers.map((approver, i) => (i === index ? Object.assign({}, approver, { [key]: field_value }) : approver));
    emit_approvers(next_approvers);
  };

  const handle_level_change = (index, level) => {
    set_draft_paths((previous) => Object.assign({}, previous, { [index]: {} }));
    const next_approvers = approvers.map((approver, i) =>
      i === index ? Object.assign({}, approver, { level, location_id: null, location_name: "" }) : approver,
    );
    emit_approvers(next_approvers);
  };

  const handle_cascade_change = (index, approver, cascade_level, location_id, location_name) => {
    const current_path = draft_paths[index] || path_from_location_id(approver.location_id, approver.level);
    const next_path = {};
    for (const entry of LEVELS_TOP_DOWN) {
      if (entry === cascade_level) break;
      if (current_path[entry] !== undefined) next_path[entry] = current_path[entry];
    }
    if (location_id !== null) next_path[cascade_level] = location_id;
    set_draft_paths((previous) => Object.assign({}, previous, { [index]: next_path }));

    // Only a pick at the approver's own level is the final location; higher picks just narrow the cascade.
    const is_final = cascade_level === approver.level && location_id !== null;
    const next_approvers = approvers.map((entry, i) =>
      i === index
        ? Object.assign({}, entry, { location_id: is_final ? location_id : null, location_name: is_final ? location_name : "" })
        : entry,
    );
    emit_approvers(next_approvers);
  };

  const handle_condition_change = (index, condition_index, key, condition_value) => {
    const approver = approvers[index];
    const next_conditions = (approver.conditions || []).map((condition, i) => {
      if (i !== condition_index) return condition;
      // Switching the field resets the value, since values belong to one field's options.
      if (key === "field_id") return { field_id: condition_value, value: "" };
      return Object.assign({}, condition, { [key]: condition_value });
    });
    handle_approver_change(index, "conditions", next_conditions);
  };

  const add_condition = (index) => {
    const approver = approvers[index];
    handle_approver_change(index, "conditions", [...(approver.conditions || []), { field_id: "", value: "" }]);
  };

  const remove_condition = (index, condition_index) => {
    const approver = approvers[index];
    handle_approver_change(index, "conditions", (approver.conditions || []).filter((_, i) => i !== condition_index));
  };

  const cascade_levels_for = (level) => LEVELS_TOP_DOWN.slice(0, LEVELS_TOP_DOWN.indexOf(level) + 1);

  return (
    <div className="bg-white border border-gray-200 ppp-xl mt-4">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="approval-flow-toggle"
            checked={enabled}
            onChange={handle_toggle}
            className="w-4 h-4 text-blue-600 border-gray-300 ppp focus:ring-blue-500"
          />
          <label htmlFor="approval-flow-toggle" className="text-lg font-bold text-gray-900 cursor-pointer select-none">
            {translate("DCS_APPROVAL_ENABLE_LABEL")}
          </label>
        </div>
      </div>

      <div className="px-6 py-3">
        <p className="text-sm text-gray-500">{translate("DCS_APPROVAL_ENABLE_HINT")}</p>
      </div>

      {enabled && (
        <div className="px-6 pb-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="approval-count" className={LABEL_CLASS}>
                {translate("DCS_APPROVAL_COUNT_LABEL")} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="approval-count"
                min={1}
                max={MAX_APPROVERS}
                value={approvers.length}
                onChange={(event) => handle_count_change(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex items-end">
              <p className="text-sm text-gray-500 pb-2">{translate("DCS_APPROVAL_ORDER_HINT")}</p>
            </div>
          </div>

          {approvers.map((approver, index) => {
            const email_invalid = (approver.email || "").trim() !== "" && !EMAIL_REGEX.test(approver.email.trim());
            const level = APPROVER_LEVELS.includes(approver.level) ? approver.level : "";
            const path = draft_paths[index] || path_from_location_id(approver.location_id, level);
            const conditions = approver.conditions || [];
            return (
              <div key={index} className="border border-gray-200 ppp-lg p-5 space-y-4 bg-gray-50">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center justify-center w-6 h-6 ppp-full bg-blue-600 text-white text-xs font-bold">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-bold text-gray-900">
                    {translate("DCS_APPROVAL_APPROVER_TITLE", { number: index + 1 })}
                  </h3>
                  {level && approver.location_name ? (
                    <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5">
                      {translate(`DCS_APPROVAL_LEVEL_${level}`)} - {approver.location_name}
                    </span>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={LABEL_CLASS}>
                      {translate("DCS_APPROVAL_FIELD_NAME")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={approver.name}
                      onChange={(event) => handle_approver_change(index, "name", event.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={LABEL_CLASS}>
                      {translate("DCS_APPROVAL_FIELD_ROLE")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={approver.role}
                      onChange={(event) => handle_approver_change(index, "role", event.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={LABEL_CLASS}>
                      {translate("DCS_APPROVAL_FIELD_EMAIL")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={approver.email}
                      onChange={(event) => handle_approver_change(index, "email", event.target.value)}
                      className={`${INPUT_CLASS} ${email_invalid ? "border-red-400 focus:border-red-500 focus:ring-red-500" : ""}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={LABEL_CLASS}>{translate("DCS_APPROVAL_FIELD_LEVEL")}</label>
                    <select value={level} onChange={(event) => handle_level_change(index, event.target.value)} className={INPUT_CLASS}>
                      <option value="">{translate("DCS_APPROVAL_LEVEL_NONE")}</option>
                      {APPROVER_LEVELS.map((entry) => (
                        <option key={entry} value={entry}>
                          {translate(`DCS_APPROVAL_LEVEL_${entry}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {level && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cascade_levels_for(level).map((cascade_level, position) => {
                      const parent_level = position === 0 ? null : cascade_levels_for(level)[position - 1];
                      return (
                        <LocationSelect
                          key={cascade_level}
                          level={cascade_level}
                          parent_id={parent_level ? (path[parent_level] !== undefined ? path[parent_level] : null) : null}
                          value={path[cascade_level] !== undefined ? path[cascade_level] : null}
                          onChange={(location_id, location_name) =>
                            handle_cascade_change(index, Object.assign({}, approver, { level }), cascade_level, location_id, location_name)
                          }
                          label={translate(`DCS_APPROVAL_LEVEL_${cascade_level}`)}
                          placeholder={translate("DCS_APPROVAL_SELECT_PLACEHOLDER")}
                        />
                      );
                    })}
                  </div>
                )}

                <div className="space-y-2">
                  <label className={LABEL_CLASS}>{translate("DCS_APPROVAL_CONDITIONS_LABEL")}</label>
                  {conditions.map((condition, condition_index) => {
                    const target_field = condition_fields.find((entry) => entry.id === condition.field_id);
                    const inline_options = target_field && !target_field.lazy_options && Array.isArray(target_field.options) && target_field.options.length > 0
                      ? target_field.options
                      : null;
                    return (
                      <div key={condition_index} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                        <select
                          value={condition.field_id}
                          onChange={(event) => handle_condition_change(index, condition_index, "field_id", event.target.value)}
                          className={INPUT_CLASS}
                        >
                          <option value="">{translate("DCS_APPROVAL_CONDITION_FIELD")}</option>
                          {condition_fields.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {field_label(entry, language)}
                            </option>
                          ))}
                        </select>
                        {inline_options ? (
                          <select
                            value={condition.value}
                            onChange={(event) => handle_condition_change(index, condition_index, "value", event.target.value)}
                            className={INPUT_CLASS}
                          >
                            <option value="">{translate("DCS_APPROVAL_CONDITION_VALUE")}</option>
                            {inline_options.map((option) => (
                              <option key={option.id || String(option.value)} value={String(option.value)}>
                                {option_label(option, language)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={condition.value}
                            placeholder={translate("DCS_APPROVAL_CONDITION_VALUE")}
                            onChange={(event) => handle_condition_change(index, condition_index, "value", event.target.value)}
                            className={INPUT_CLASS}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => remove_condition(index, condition_index)}
                          className="text-sm font-semibold text-red-500 hover:text-red-700 px-2 py-2"
                        >
                          {translate("DCS_APPROVAL_CONDITION_REMOVE")}
                        </button>
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => add_condition(index)} className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                    + {translate("DCS_APPROVAL_CONDITION_ADD")}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={LABEL_CLASS}>{translate("DCS_APPROVAL_FORCE_LABEL")}</label>
                    <select
                      value={approver.force === false ? "off" : "on"}
                      onChange={(event) => handle_approver_change(index, "force", event.target.value === "on")}
                      className={INPUT_CLASS}
                    >
                      <option value="on">{translate("DCS_APPROVAL_FORCE_ON")}</option>
                      <option value="off">{translate("DCS_APPROVAL_FORCE_OFF")}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className={LABEL_CLASS}>{translate("DCS_APPROVAL_ON_REJECT_LABEL")}</label>
                    <select
                      value={approver.on_reject}
                      onChange={(event) => handle_approver_change(index, "on_reject", event.target.value)}
                      className={INPUT_CLASS}
                    >
                      <option value="stop">{translate("DCS_APPROVAL_ON_REJECT_STOP")}</option>
                      <option value="continue">{translate("DCS_APPROVAL_ON_REJECT_CONTINUE")}</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}

          {!is_approval_config_complete({ enabled: true, approvers }) && (
            <div className="bg-amber-50 border border-amber-200 ppp-lg p-3">
              <p className="text-sm text-amber-600">{translate("DCS_APPROVAL_CONFIG_INCOMPLETE")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
