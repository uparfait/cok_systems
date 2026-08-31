import React, { useState } from "react";
import { FiCheckCircle, FiUser, FiMapPin, FiFilter, FiMove, FiTrash2, FiPlus, FiShield } from "react-icons/fi";
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

// Same palette and type scale as the booking form (BookNow.jsx).
const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const DANGER = "#E74C3C";
const BORDER = "#E0E0E0";
const GRAY = "#9E9E9E";
const NEUTRAL_DARK = "#333333";
const NEUTRAL_LIGHT = "#F7F9FB";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";

const labelStyle = {
  fontFamily: fontHeading, fontSize: "13px", fontWeight: 600,
  letterSpacing: "0.5px", lineHeight: "1.4", display: "block",
  color: NEUTRAL_DARK, textTransform: "uppercase", marginBottom: "8px",
};
const inputClassName = "w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm";

// Client-side mirror of the backend's approval_config validation.
export function is_approval_config_complete(config) {
  if (!config || config.enabled !== true) return true;
  if (!Array.isArray(config.approvers) || config.approvers.length === 0) return false;
  return config.approvers.every((approver) => people_ok(approver) && location_ok(approver) && conditions_ok(approver));
}

function people_ok(approver) {
  return !!(approver.name.trim() && approver.role.trim() && EMAIL_REGEX.test(approver.email.trim()));
}

function location_ok(approver) {
  if (!approver.level) return true;
  return approver.location_id !== null && approver.location_id !== undefined && `${approver.location_id}` !== "";
}

function conditions_ok(approver) {
  return (approver.conditions || []).every(
    (condition) => condition.field_id && `${condition.value === undefined || condition.value === null ? "" : condition.value}`.trim(),
  );
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

  React.useEffect(() => {
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
    <div>
      <label style={labelStyle}>
        {label} <span style={{ color: DANGER }}>*</span>
      </label>
      <select
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(event) => {
          const selected = options.find((option) => String(option.location_id) === event.target.value);
          onChange(selected ? selected.location_id : null, selected ? selected.name : "");
        }}
        disabled={parent_missing}
        className={inputClassName}
        style={parent_missing ? { backgroundColor: NEUTRAL_LIGHT, color: GRAY } : undefined}
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

/** Small numbered identity chip reused on every wizard part so rows stay recognizable. */
function ApproverBadge({ index, name, translate }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold shrink-0"
        style={{ backgroundColor: PRIMARY, color: WHITE, borderRadius: "50%", fontFamily: fontHeading }}
      >
        {index + 1}
      </span>
      <span className="text-sm font-bold truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
        {name.trim() || translate("DCS_APPROVAL_APPROVER_TITLE", { number: index + 1 })}
      </span>
    </div>
  );
}

// Optional pre-publish step: the form owner defines who must approve each submitted response.
// Laid out as a booking-form-style wizard: People -> Location -> Conditions -> Order & rules,
// with a stepper showing where you are. Approvers sign in the order arranged on the last part.
export default function ApprovalFlowSection({ value, onChange, fields, onSave }) {
  const { translate, language } = useDcsLanguage();
  const enabled = !!value && value.enabled === true;
  const approvers = (value && value.approvers) || [];
  const condition_fields = flatten_condition_fields(fields);

  const [wizard_step, set_wizard_step] = useState(1);
  const [max_visited, set_max_visited] = useState(1);
  const [show_step_error, set_show_step_error] = useState(false);
  const [saving, set_saving] = useState(false);
  // Transient cascade picks (per approver index) that don't yet amount to a final location.
  const [draft_paths, set_draft_paths] = useState({});
  const [drag_index, set_drag_index] = useState(null);

  const STEPS = [
    { step: 1, label: translate("DCS_APPROVAL_STEP_PEOPLE"), icon: FiUser },
    { step: 2, label: translate("DCS_APPROVAL_STEP_LOCATION"), icon: FiMapPin },
    { step: 3, label: translate("DCS_APPROVAL_STEP_CONDITIONS"), icon: FiFilter },
    { step: 4, label: translate("DCS_APPROVAL_STEP_ORDER"), icon: FiMove },
  ];

  const emit = (next) => onChange(next);
  const emit_approvers = (next_approvers) => emit({ enabled: true, approvers: next_approvers });

  const handle_toggle = () => {
    if (enabled) {
      emit(null);
    } else {
      emit({ enabled: true, approvers: [Object.assign({}, EMPTY_APPROVER)] });
      set_wizard_step(1);
      set_max_visited(1);
      set_show_step_error(false);
      set_draft_paths({});
    }
  };

  const step_valid = (step) => {
    if (step === 1) return approvers.length > 0 && approvers.every(people_ok);
    if (step === 2) return approvers.every(location_ok);
    if (step === 3) return approvers.every(conditions_ok);
    return true;
  };

  // Persists the approvers through the page's onSave (which updates the form on the server).
  const handle_save = async () => {
    if (!is_approval_config_complete({ enabled: true, approvers })) {
      set_show_step_error(true);
      return;
    }
    set_show_step_error(false);
    set_saving(true);
    try {
      await onSave({ enabled: true, approvers });
    } finally {
      set_saving(false);
    }
  };

  const go_next = () => {
    if (!step_valid(wizard_step)) {
      set_show_step_error(true);
      return;
    }
    set_show_step_error(false);
    const next = Math.min(4, wizard_step + 1);
    set_wizard_step(next);
    set_max_visited((previous) => Math.max(previous, next));
  };

  const go_back = () => {
    set_show_step_error(false);
    set_wizard_step((previous) => Math.max(1, previous - 1));
  };

  const go_to = (step) => {
    if (step <= max_visited || step < wizard_step) {
      set_show_step_error(false);
      set_wizard_step(step);
    }
  };

  const handle_approver_change = (index, key, field_value) => {
    emit_approvers(approvers.map((approver, i) => (i === index ? Object.assign({}, approver, { [key]: field_value }) : approver)));
  };

  const add_approver = () => {
    if (approvers.length >= MAX_APPROVERS) return;
    emit_approvers([...approvers, Object.assign({}, EMPTY_APPROVER)]);
  };

  const remove_approver = (index) => {
    if (approvers.length <= 1) return;
    set_draft_paths({});
    emit_approvers(approvers.filter((_, i) => i !== index));
  };

  const handle_level_change = (index, level) => {
    set_draft_paths((previous) => Object.assign({}, previous, { [index]: {} }));
    emit_approvers(
      approvers.map((approver, i) => (i === index ? Object.assign({}, approver, { level, location_id: null, location_name: "" }) : approver)),
    );
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
    emit_approvers(
      approvers.map((entry, i) =>
        i === index
          ? Object.assign({}, entry, { location_id: is_final ? location_id : null, location_name: is_final ? location_name : "" })
          : entry,
      ),
    );
  };

  const handle_condition_change = (index, condition_index, key, condition_value) => {
    const next_conditions = (approvers[index].conditions || []).map((condition, i) => {
      if (i !== condition_index) return condition;
      // Switching the field resets the value, since values belong to one field's options.
      if (key === "field_id") return { field_id: condition_value, value: "" };
      return Object.assign({}, condition, { [key]: condition_value });
    });
    handle_approver_change(index, "conditions", next_conditions);
  };

  const add_condition = (index) => {
    handle_approver_change(index, "conditions", [...(approvers[index].conditions || []), { field_id: "", value: "" }]);
  };

  const remove_condition = (index, condition_index) => {
    handle_approver_change(index, "conditions", (approvers[index].conditions || []).filter((_, i) => i !== condition_index));
  };

  const handle_drop = (target_index) => {
    if (drag_index === null || drag_index === target_index) return;
    const next = [...approvers];
    const [moved] = next.splice(drag_index, 1);
    next.splice(target_index, 0, moved);
    set_draft_paths({});
    set_drag_index(null);
    emit_approvers(next);
  };

  const cascade_levels_for = (level) => LEVELS_TOP_DOWN.slice(0, LEVELS_TOP_DOWN.indexOf(level) + 1);

  return (
    <div className="mt-4" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}` }}>
      {/* Header banner - same treatment as the booking form's blue title block */}
      <div className="px-6 py-5 flex items-center gap-3"
        style={{ backgroundColor: enabled ? PRIMARY : WHITE, borderBottom: enabled ? "none" : `1px solid ${BORDER}` }}>
        <input
          type="checkbox"
          id="approval-flow-toggle"
          checked={enabled}
          onChange={handle_toggle}
          className="w-4 h-4 cursor-pointer shrink-0"
          style={{ accentColor: enabled ? WHITE : PRIMARY }}
        />
        <div className="w-8 h-8 flex items-center justify-center shrink-0"
          style={{ backgroundColor: enabled ? "rgba(255,255,255,0.2)" : "#E0E0E0" }}>
          <FiShield className="w-4 h-4" style={{ color: WHITE }} />
        </div>
        <div className="min-w-0">
          <label htmlFor="approval-flow-toggle" className="block text-lg font-extrabold cursor-pointer select-none leading-tight"
            style={{ color: enabled ? WHITE : NEUTRAL_DARK, fontFamily: fontHeading, letterSpacing: "-0.5px" }}>
            {translate("DCS_APPROVAL_ENABLE_LABEL")}
          </label>
          <p className="text-xs mt-0.5" style={{ color: enabled ? "rgba(255,255,255,0.85)" : GRAY, fontFamily: fontHeading }}>
            {translate("DCS_APPROVAL_ENABLE_HINT")}
          </p>
        </div>
      </div>

      {enabled && (
        <>
          {/* Required-fields strip, same as the booking form */}
          <div className="px-6 py-3 text-center" style={{ backgroundColor: WHITE, borderBottom: `1px solid ${BORDER}` }}>
            <p className="text-xs font-medium" style={{ color: GRAY, fontFamily: fontHeading }}>
              {translate("DCS_APPROVAL_REQUIRED_HINT")
                .split("*")
                .map((part, i, parts) => (
                  <React.Fragment key={i}>
                    {part}
                    {i < parts.length - 1 && <span style={{ color: DANGER }}>*</span>}
                  </React.Fragment>
                ))}
            </p>
          </div>
          {/* Stepper - same look as the booking form's CreateEventStepper */}
          <div
            className="flex items-center justify-start sm:justify-center gap-1 sm:gap-0 overflow-x-auto touch-pan-x px-3 sm:px-6 py-3"
            style={{ backgroundColor: WHITE, borderBottom: `1px solid ${BORDER}`, WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
          >
            {STEPS.map((entry, idx) => {
              const done = wizard_step > entry.step && step_valid(entry.step);
              const active = wizard_step === entry.step;
              const can_click = entry.step <= max_visited || entry.step < wizard_step;
              return (
                <div key={entry.step} className="flex items-center shrink-0">
                  <button type="button" disabled={!can_click} onClick={() => go_to(entry.step)}
                    className="flex flex-col items-center justify-center gap-1 transition-all cursor-pointer">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs font-bold transition-all duration-300"
                      style={{ backgroundColor: done ? SUCCESS : active ? PRIMARY : "#E0E0E0", color: done || active ? WHITE : GRAY, borderRadius: "50%" }}>
                      {done ? <FiCheckCircle className="w-4 h-4" /> : entry.step}
                    </div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap mt-1"
                      style={{ color: done ? SUCCESS : active ? PRIMARY : GRAY, fontFamily: fontHeading }}>
                      {entry.label}
                    </span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className="h-0.5 w-4 sm:w-12 mx-1 mb-4 transition-all duration-300"
                      style={{ backgroundColor: wizard_step > entry.step ? SUCCESS : BORDER }} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-6 space-y-4">
            {/* Part 1 - who approves */}
            {wizard_step === 1 && (
              <>
                {approvers.map((approver, index) => {
                  const email_invalid = (approver.email || "").trim() !== "" && !EMAIL_REGEX.test(approver.email.trim());
                  return (
                    <div key={index} className="p-4 space-y-4" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                      <div className="flex items-center justify-between gap-2">
                        <ApproverBadge index={index} name={approver.name} translate={translate} />
                        {approvers.length > 1 && (
                          <button type="button" onClick={() => remove_approver(index)}
                            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide"
                            style={{ color: DANGER, fontFamily: fontHeading }}>
                            <FiTrash2 className="w-3.5 h-3.5" /> {translate("DCS_APPROVAL_REMOVE_APPROVER")}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label style={labelStyle}>{translate("DCS_APPROVAL_FIELD_NAME")} <span style={{ color: DANGER }}>*</span></label>
                          <input type="text" value={approver.name}
                            onChange={(event) => handle_approver_change(index, "name", event.target.value)}
                            className={inputClassName} />
                        </div>
                        <div>
                          <label style={labelStyle}>{translate("DCS_APPROVAL_FIELD_ROLE")} <span style={{ color: DANGER }}>*</span></label>
                          <input type="text" value={approver.role}
                            onChange={(event) => handle_approver_change(index, "role", event.target.value)}
                            className={inputClassName} />
                        </div>
                        <div>
                          <label style={labelStyle}>{translate("DCS_APPROVAL_FIELD_EMAIL")} <span style={{ color: DANGER }}>*</span></label>
                          <input type="email" value={approver.email}
                            onChange={(event) => handle_approver_change(index, "email", event.target.value)}
                            className={inputClassName}
                            style={email_invalid ? { borderColor: DANGER } : undefined} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {approvers.length < MAX_APPROVERS && (
                  <button type="button" onClick={add_approver}
                    className="w-full py-3 text-sm font-semibold uppercase tracking-wide inline-flex items-center justify-center gap-2"
                    style={{ color: PRIMARY, border: `1px dashed ${PRIMARY}`, fontFamily: fontHeading, backgroundColor: WHITE }}>
                    <FiPlus className="w-4 h-4" /> {translate("DCS_APPROVAL_ADD_APPROVER")}
                  </button>
                )}
              </>
            )}

            {/* Part 2 - where each approver works */}
            {wizard_step === 2 && (
              <>
                <p className="text-xs" style={{ color: GRAY, fontFamily: fontHeading }}>{translate("DCS_APPROVAL_LOCATION_HINT")}</p>
                {approvers.map((approver, index) => {
                  const level = APPROVER_LEVELS.includes(approver.level) ? approver.level : "";
                  const path = draft_paths[index] || path_from_location_id(approver.location_id, level);
                  return (
                    <div key={index} className="p-4 space-y-4" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <ApproverBadge index={index} name={approver.name} translate={translate} />
                        {level && approver.location_name ? (
                          <span className="text-xs font-semibold px-2 py-0.5" style={{ color: PRIMARY, backgroundColor: "#E3F2FD", fontFamily: fontHeading }}>
                            {translate(`DCS_APPROVAL_LEVEL_${level}`)} - {approver.location_name}
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label style={labelStyle}>{translate("DCS_APPROVAL_FIELD_LEVEL")}</label>
                          <select value={level} onChange={(event) => handle_level_change(index, event.target.value)} className={inputClassName}>
                            <option value="">{translate("DCS_APPROVAL_LEVEL_NONE")}</option>
                            {APPROVER_LEVELS.map((entry) => (
                              <option key={entry} value={entry}>{translate(`DCS_APPROVAL_LEVEL_${entry}`)}</option>
                            ))}
                          </select>
                        </div>
                        {level &&
                          cascade_levels_for(level).map((cascade_level, position) => {
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
                    </div>
                  );
                })}
              </>
            )}

            {/* Part 3 - "field equals value" conditions */}
            {wizard_step === 3 && (
              <>
                <p className="text-xs" style={{ color: GRAY, fontFamily: fontHeading }}>{translate("DCS_APPROVAL_CONDITIONS_HINT")}</p>
                {approvers.map((approver, index) => {
                  const conditions = approver.conditions || [];
                  return (
                    <div key={index} className="p-4 space-y-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                      <ApproverBadge index={index} name={approver.name} translate={translate} />
                      {conditions.map((condition, condition_index) => {
                        const target_field = condition_fields.find((entry) => entry.id === condition.field_id);
                        const inline_options =
                          target_field && !target_field.lazy_options && Array.isArray(target_field.options) && target_field.options.length > 0
                            ? target_field.options
                            : null;
                        return (
                          <div key={condition_index} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                            <select
                              value={condition.field_id}
                              onChange={(event) => handle_condition_change(index, condition_index, "field_id", event.target.value)}
                              className={inputClassName}
                            >
                              <option value="">{translate("DCS_APPROVAL_CONDITION_FIELD")}</option>
                              {condition_fields.map((entry) => (
                                <option key={entry.id} value={entry.id}>{field_label(entry, language)}</option>
                              ))}
                            </select>
                            {inline_options ? (
                              <select
                                value={condition.value}
                                onChange={(event) => handle_condition_change(index, condition_index, "value", event.target.value)}
                                className={inputClassName}
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
                                className={inputClassName}
                              />
                            )}
                            <button type="button" onClick={() => remove_condition(index, condition_index)}
                              className="inline-flex items-center justify-center p-2" style={{ color: DANGER }}>
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                      <button type="button" onClick={() => add_condition(index)}
                        className="text-sm font-semibold inline-flex items-center gap-1"
                        style={{ color: PRIMARY, fontFamily: fontHeading }}>
                        <FiPlus className="w-4 h-4" /> {translate("DCS_APPROVAL_CONDITION_ADD")}
                      </button>
                    </div>
                  );
                })}
              </>
            )}

            {/* Part 4 - drag to order, force and on-reject rules */}
            {wizard_step === 4 && (
              <>
                <p className="text-xs" style={{ color: GRAY, fontFamily: fontHeading }}>{translate("DCS_APPROVAL_DRAG_HINT")}</p>
                {approvers.map((approver, index) => {
                  const level = APPROVER_LEVELS.includes(approver.level) ? approver.level : "";
                  const conditions = approver.conditions || [];
                  return (
                    <div
                      key={index}
                      draggable
                      onDragStart={() => set_drag_index(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handle_drop(index)}
                      onDragEnd={() => set_drag_index(null)}
                      className="p-4 space-y-3 cursor-move"
                      style={{
                        backgroundColor: drag_index === index ? "#E3F2FD" : NEUTRAL_LIGHT,
                        border: `1px solid ${drag_index === index ? PRIMARY : BORDER}`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <FiMove className="w-4 h-4 shrink-0" style={{ color: GRAY }} />
                          <ApproverBadge index={index} name={approver.name} translate={translate} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {level && approver.location_name ? (
                            <span className="text-xs font-semibold px-2 py-0.5" style={{ color: PRIMARY, backgroundColor: "#E3F2FD", fontFamily: fontHeading }}>
                              {translate(`DCS_APPROVAL_LEVEL_${level}`)} - {approver.location_name}
                            </span>
                          ) : null}
                          {conditions.length > 0 && (
                            <span className="text-xs font-semibold px-2 py-0.5 inline-flex items-center gap-1"
                              style={{ color: "#795548", backgroundColor: "#FFF3E0", fontFamily: fontHeading }}>
                              <FiFilter className="w-3 h-3" /> {conditions.length}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label style={labelStyle}>{translate("DCS_APPROVAL_FORCE_LABEL")}</label>
                          <select
                            value={approver.force === false ? "off" : "on"}
                            onChange={(event) => handle_approver_change(index, "force", event.target.value === "on")}
                            className={inputClassName}
                          >
                            <option value="on">{translate("DCS_APPROVAL_FORCE_ON")}</option>
                            <option value="off">{translate("DCS_APPROVAL_FORCE_OFF")}</option>
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>{translate("DCS_APPROVAL_ON_REJECT_LABEL")}</label>
                          <select
                            value={approver.on_reject}
                            onChange={(event) => handle_approver_change(index, "on_reject", event.target.value)}
                            className={inputClassName}
                          >
                            <option value="stop">{translate("DCS_APPROVAL_ON_REJECT_STOP")}</option>
                            <option value="continue">{translate("DCS_APPROVAL_ON_REJECT_CONTINUE")}</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {show_step_error && (!step_valid(wizard_step) || (wizard_step === 4 && !is_approval_config_complete({ enabled: true, approvers }))) && (
              <div className="p-3" style={{ backgroundColor: "#FDECEA", border: `1px solid ${DANGER}` }}>
                <p className="text-sm" style={{ color: DANGER, fontFamily: fontHeading }}>
                  {translate(wizard_step === 4 ? "DCS_APPROVAL_CONFIG_INCOMPLETE" : "DCS_APPROVAL_STEP_INCOMPLETE")}
                </p>
              </div>
            )}

            {/* Navigation - same button treatment as the booking form */}
            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "16px" }}>
              <div className="flex items-stretch gap-3">
                {wizard_step > 1 && (
                  <button type="button" onClick={go_back} className="cok-btn-outlined shrink-0" style={{ fontFamily: fontHeading }}>
                    {translate("DCS_APPROVAL_BACK")}
                  </button>
                )}
                {wizard_step < 4 ? (
                  <button type="button" onClick={go_next} className="cok-btn-primary" style={{ flex: 1, fontFamily: fontHeading }}>
                    {translate("DCS_APPROVAL_NEXT")}
                  </button>
                ) : onSave ? (
                  <button type="button" onClick={handle_save} disabled={saving}
                    className="cok-btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ flex: 1, fontFamily: fontHeading }}>
                    {saving ? (
                      <div className="animate-spin" style={{ width: 16, height: 16, border: `2px solid ${WHITE}`, borderTopColor: "transparent", borderRadius: "50%" }} />
                    ) : (
                      <><FiCheckCircle style={{ width: 16, height: 16 }} /> {translate("DCS_APPROVAL_SAVE")}</>
                    )}
                  </button>
                ) : (
                  <div className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold"
                    style={{ color: is_approval_config_complete({ enabled: true, approvers }) ? SUCCESS : GRAY, fontFamily: fontHeading }}>
                    <FiCheckCircle className="w-4 h-4" />
                    {translate(is_approval_config_complete({ enabled: true, approvers }) ? "DCS_APPROVAL_WIZARD_READY" : "DCS_APPROVAL_CONFIG_INCOMPLETE")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
