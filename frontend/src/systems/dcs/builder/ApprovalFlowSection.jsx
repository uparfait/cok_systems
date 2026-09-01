import React, { useState } from "react";
import { FiCheckCircle, FiUser, FiFilter, FiMove, FiTrash2, FiPlus, FiShield } from "react-icons/fi";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_APPROVERS = 20;

const APPROVER_LEVELS = ["VILLAGE", "CELL", "SECTOR", "DISTRICT", "PROVINCE"];

// Choice fields whose condition value comes from a dropdown of the field's own options
// (a location field's provinces/districts/... included) instead of free text.
const CHOICE_FIELD_TYPES = ["single_select", "multi_select", "select_group", "cascading_select", "likert_scale"];

/** Every selectable value a field (or a lazy-options response) carries, groups flattened. */
function flatten_option_data(data) {
  if (!data) return [];
  if (Array.isArray(data.options) && data.options.length > 0) return data.options;
  if (Array.isArray(data.parent_option_groups)) return data.parent_option_groups.flatMap((group) => group.options || []);
  return [];
}

// The whole-country location tree the api-sourced cascading_select fields feed from
// (see CascadingSelectField.jsx) - fetched once per language and shared by every condition.
const location_tree_cache = new Map();
function fetch_location_tree(language) {
  if (!location_tree_cache.has(language)) {
    location_tree_cache.set(
      language,
      fetch(`/dcs/api/locations/all?language=${language}`)
        .then((response) => response.json())
        .then((result) => (result && result.success ? result.data : null))
        .catch(() => null),
    );
  }
  return location_tree_cache.get(language);
}

// Drill-down order of the location tree's levels, and each level's display-name key.
const LOCATION_LEVELS_ORDER = ["provinces", "districts", "sectors", "cells", "villages"];
const LEVEL_LABEL_KEYS = {
  provinces: "DCS_APPROVAL_LEVEL_PROVINCE",
  districts: "DCS_APPROVAL_LEVEL_DISTRICT",
  sectors: "DCS_APPROVAL_LEVEL_SECTOR",
  cells: "DCS_APPROVAL_LEVEL_CELL",
  villages: "DCS_APPROVAL_LEVEL_VILLAGE",
};

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

/**
 * Value picker for a condition on a choice field: one dropdown listing every value the
 * field can take (a location field's provinces/districts/sectors/cells/villages included).
 * The form is delivered with heavy option lists stripped (lazy_options), so those are
 * fetched back - complete, no parent filter - through resolveFullFieldOptions, which the
 * settings page already provides with caching. Free text is only the last resort while
 * nothing is available (e.g. a lazy field on a page without a resolver).
 */
// Above this many entries a filter box appears and the dropdown only renders matches -
// a native select with thousands of options (villages, cells) freezes the page otherwise.
const FILTER_THRESHOLD = 300;
const MAX_SHOWN_OPTIONS = 200;

function ConditionValueControl({ field, value, onChange, resolveFullFieldOptions, language, placeholder, filterPlaceholder }) {
  const [fetched_options, set_fetched_options] = useState(null);
  const [filter_text, set_filter_text] = useState("");
  const local_options = React.useMemo(() => flatten_option_data(field), [field]);
  const needs_fetch = local_options.length === 0 && !!field.lazy_options && !!resolveFullFieldOptions;

  React.useEffect(() => {
    set_fetched_options(null);
    set_filter_text("");
    if (!needs_fetch) return undefined;
    let cancelled = false;
    resolveFullFieldOptions(field.id)
      .then((data) => {
        if (!cancelled) set_fetched_options(flatten_option_data(data));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [field.id, needs_fetch, resolveFullFieldOptions]);

  // Dedupe + sort once per data load, never per keystroke. The same value under several
  // groups (one sector name in many districts) collapses to a single entry - conditions
  // match by value. Long lists read best alphabetically; short hand-ordered ones
  // (a likert scale) keep the author's own order.
  const options = React.useMemo(() => {
    const seen = new Set();
    const list = [];
    (local_options.length > 0 ? local_options : fetched_options || []).forEach((option) => {
      const key = String(option.value);
      if (seen.has(key)) return;
      seen.add(key);
      list.push(option);
    });
    if (list.length > 20) {
      const collator = new Intl.Collator(language);
      list.sort((a, b) => collator.compare(option_label(a, language), option_label(b, language)));
    }
    return list;
  }, [local_options, fetched_options, language]);

  if (options.length === 0) {
    return (
      <input type="text" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={inputClassName} />
    );
  }

  // Every typed word must appear in an entry's label; only the first matches render,
  // so a thousands-strong list never lands in the DOM at once.
  const use_filter = options.length > FILTER_THRESHOLD;
  let shown = options;
  let hidden_count = 0;
  if (use_filter) {
    const terms = filter_text.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = terms.length === 0 ? options : options.filter((option) => option_label(option, language).toLowerCase().includes(terms[0]) && terms.every((term) => option_label(option, language).toLowerCase().includes(term)));
    shown = matches.slice(0, MAX_SHOWN_OPTIONS);
    hidden_count = matches.length - shown.length;
    if (value && !shown.some((option) => String(option.value) === value)) {
      const current = options.find((option) => String(option.value) === value);
      if (current) shown = [current, ...shown];
    }
  }

  const select_element = (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClassName}>
      <option value="">{placeholder}</option>
      {shown.map((option) => (
        <option key={option.id || String(option.value)} value={String(option.value)}>
          {option_label(option, language)}
        </option>
      ))}
    </select>
  );

  if (!use_filter) return select_element;
  return (
    <div className="space-y-1 min-w-0">
      <input
        type="text"
        value={filter_text}
        placeholder={filterPlaceholder}
        onChange={(event) => set_filter_text(event.target.value)}
        className={inputClassName}
      />
      {select_element}
      {hidden_count > 0 && (
        <p className="text-[11px]" style={{ color: GRAY, fontFamily: fontHeading }}>
          +{hidden_count}
        </p>
      )}
    </div>
  );
}

/**
 * Guided drill-down for a location condition, exactly like filling the form itself:
 * one small select per level, top-down - pick the province, then only its districts,
 * then only that district's sectors, and so on until the field's own level. Nobody
 * scrolls a country-wide list. The pick at the field's level becomes the condition
 * value; the picks above it are handed back so the ancestor conditions get pinned too.
 */
function LocationTrailPicker({ field_key, api_level, value, onChange, language, sibling_values }) {
  const { translate } = useDcsLanguage();
  const [tree, set_tree] = useState(null);
  const depth = Math.max(0, LOCATION_LEVELS_ORDER.indexOf(api_level));

  // Seed the trail from this approver's other location conditions plus the saved value,
  // so reopening a saved condition shows the whole trail instead of empty selects.
  const initial_picks = () => {
    const picks = {};
    for (let i = 0; i < depth; i++) {
      const level = LOCATION_LEVELS_ORDER[i];
      if (sibling_values && sibling_values[level]) picks[level] = sibling_values[level];
      else break;
    }
    if (value) picks[api_level] = value;
    return picks;
  };
  const [picks, set_picks] = useState(initial_picks);

  React.useEffect(() => {
    let cancelled = false;
    fetch_location_tree(language).then((loaded) => {
      if (!cancelled) set_tree(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  // Switching the condition to a different field restarts the trail for that field.
  React.useEffect(() => {
    set_picks(initial_picks());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field_key]);

  const items_at = (level_index) => {
    const country = tree && tree.Rwanda;
    if (!country) return [];
    let items = country.provinces || [];
    for (let i = 0; i < level_index; i++) {
      const pick = picks[LOCATION_LEVELS_ORDER[i]];
      const found = items.find((item) => String((item && item.name) || item) === pick);
      if (!found || typeof found === "string") return [];
      items = (i === 0 ? found.districts : i === 1 ? found.sectors : i === 2 ? found.cells : found.villages) || [];
    }
    return items;
  };

  const handle_pick = (level_index, picked_value) => {
    const next = {};
    for (let i = 0; i < level_index; i++) next[LOCATION_LEVELS_ORDER[i]] = picks[LOCATION_LEVELS_ORDER[i]];
    if (picked_value) next[LOCATION_LEVELS_ORDER[level_index]] = picked_value;
    set_picks(next);
    if (level_index === depth && picked_value) {
      onChange(picked_value, { value: picked_value, path: LOCATION_LEVELS_ORDER.slice(0, depth).map((level) => ({ level, value: next[level] })) });
    } else if (value) {
      // The trail changed above the committed pick - clear the value until re-picked.
      onChange("", null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 min-w-0">
      {LOCATION_LEVELS_ORDER.slice(0, depth + 1).map((level, level_index) => {
        const parent_picked = level_index === 0 || !!picks[LOCATION_LEVELS_ORDER[level_index - 1]];
        const items = parent_picked ? items_at(level_index) : [];
        return (
          <select
            key={level}
            value={picks[level] || ""}
            disabled={!parent_picked || !tree}
            onChange={(event) => handle_pick(level_index, event.target.value)}
            className="cok-auth-input flex-1 min-w-[130px] pr-3 py-2 text-sm"
            style={!parent_picked || !tree ? { backgroundColor: NEUTRAL_LIGHT, color: GRAY } : undefined}
          >
            <option value="">{translate(LEVEL_LABEL_KEYS[level])}...</option>
            {items.map((item) => {
              const item_value = String((item && item.name) || item);
              const item_label = (item && item.translations && (item.translations[language] || item.translations.en)) || item_value;
              return (
                <option key={item_value} value={item_value}>
                  {item_label}
                </option>
              );
            })}
          </select>
        );
      })}
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
export default function ApprovalFlowSection({ value, onChange, fields, onSave, resolveFullFieldOptions }) {
  const { translate, language } = useDcsLanguage();
  const enabled = !!value && value.enabled === true;
  const approvers = (value && value.approvers) || [];
  const condition_fields = flatten_condition_fields(fields);

  const [wizard_step, set_wizard_step] = useState(1);
  const [max_visited, set_max_visited] = useState(1);
  const [show_step_error, set_show_step_error] = useState(false);
  const [saving, set_saving] = useState(false);
  // Flips on after a successful save; any later edit turns it back off.
  const [saved, set_saved] = useState(false);
  const [drag_index, set_drag_index] = useState(null);

  const STEPS = [
    { step: 1, label: translate("DCS_APPROVAL_STEP_PEOPLE"), icon: FiUser },
    { step: 2, label: translate("DCS_APPROVAL_STEP_CONDITIONS"), icon: FiFilter },
    { step: 3, label: translate("DCS_APPROVAL_STEP_ORDER"), icon: FiMove },
  ];

  const emit = (next) => onChange(next);
  const emit_approvers = (next_approvers) => {
    set_saved(false);
    emit({ enabled: true, approvers: next_approvers });
  };

  const handle_toggle = () => {
    if (enabled) {
      emit(null);
    } else {
      emit({ enabled: true, approvers: [Object.assign({}, EMPTY_APPROVER)] });
      set_wizard_step(1);
      set_max_visited(1);
      set_show_step_error(false);
    }
  };

  const step_valid = (step) => {
    if (step === 1) return approvers.length > 0 && approvers.every(people_ok);
    if (step === 2) return approvers.every(conditions_ok);
    return true;
  };

  // Persists the approvers through the page's onSave (which updates the form on the server).
  // On the new-form page there is no onSave yet - saving just confirms the flow, which is
  // then stored together with the form when it is published.
  const handle_save = async () => {
    if (!is_approval_config_complete({ enabled: true, approvers })) {
      set_show_step_error(true);
      return;
    }
    set_show_step_error(false);
    set_saving(true);
    try {
      if (onSave) await onSave({ enabled: true, approvers });
      set_saved(true);
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
    const next = Math.min(3, wizard_step + 1);
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
    emit_approvers(approvers.filter((_, i) => i !== index));
  };

  // The api-sourced location fields above this one on the form, keyed by their level.
  const ancestor_location_fields = (target_field) => {
    const by_id = new Map(condition_fields.map((entry) => [entry.id, entry]));
    const by_level = {};
    let parent_id = target_field.parent_field_id;
    while (parent_id && by_id.has(parent_id)) {
      const parent = by_id.get(parent_id);
      if (parent.data_source && parent.data_source.type === "api") by_level[parent.data_source.level || "provinces"] = parent;
      parent_id = parent.parent_field_id;
    }
    return by_level;
  };

  const is_api_location_field = (field) => !!field && !!field.data_source && field.data_source.type === "api";
  const find_condition_field = (field_id) => condition_fields.find((entry) => entry.id === field_id);
  const ancestor_ids_of = (field) =>
    is_api_location_field(field) ? new Set(Object.values(ancestor_location_fields(field)).map((entry) => entry.id)) : new Set();

  // Ancestor conditions pinned by a location pick stay in the data (routing matches the
  // whole trail) but never render as their own rows - the trail row already shows them.
  const hidden_condition_field_ids = (conditions) => {
    const hidden = new Set();
    conditions.forEach((condition) => {
      const field = find_condition_field(condition.field_id);
      if (!is_api_location_field(field)) return;
      ancestor_ids_of(field).forEach((ancestor_id) => {
        if (conditions.some((entry) => entry.field_id === ancestor_id)) hidden.add(ancestor_id);
      });
    });
    return hidden;
  };

  const handle_condition_change = (index, condition_index, key, condition_value) => {
    const conditions = approvers[index].conditions || [];
    // Switching a location condition to another field also drops the hidden ancestor
    // conditions its old trail pinned, so nothing keeps filtering invisibly.
    if (key === "field_id") {
      const previous = conditions[condition_index];
      const orphaned = ancestor_ids_of(previous && find_condition_field(previous.field_id));
      handle_approver_change(
        index,
        "conditions",
        conditions
          .map((condition, i) => (i === condition_index ? { field_id: condition_value, value: "" } : condition))
          .filter((condition, i) => i === condition_index || !orphaned.has(condition.field_id)),
      );
      return;
    }
    handle_approver_change(
      index,
      "conditions",
      conditions.map((condition, i) => (i === condition_index ? Object.assign({}, condition, { [key]: condition_value }) : condition)),
    );
  };

  // Picking a located entry also pins every ancestor level as its own (hidden) condition -
  // a namesake village or cell somewhere else can then never match this approver.
  const handle_location_condition_pick = (index, condition_index, target_field, picked_value, picked) => {
    const next = [...(approvers[index].conditions || [])];
    next[condition_index] = { field_id: target_field.id, value: picked_value };
    const by_level = ancestor_location_fields(target_field);
    (picked.path || []).forEach((step) => {
      const ancestor = by_level[step.level];
      if (!ancestor) return;
      const existing = next.findIndex((condition, i) => i !== condition_index && condition.field_id === ancestor.id);
      if (existing >= 0) next[existing] = { field_id: ancestor.id, value: step.value };
      else next.push({ field_id: ancestor.id, value: step.value });
    });
    handle_approver_change(index, "conditions", next);
  };

  const add_condition = (index) => {
    handle_approver_change(index, "conditions", [...(approvers[index].conditions || []), { field_id: "", value: "" }]);
  };

  // Removing a location condition also removes the hidden ancestors its trail pinned.
  const remove_condition = (index, condition_index) => {
    const conditions = approvers[index].conditions || [];
    const removed = conditions[condition_index];
    const orphaned = ancestor_ids_of(removed && find_condition_field(removed.field_id));
    handle_approver_change(index, "conditions", conditions.filter((condition, i) => i !== condition_index && !orphaned.has(condition.field_id)));
  };

  const handle_drop = (target_index) => {
    if (drag_index === null || drag_index === target_index) return;
    const next = [...approvers];
    const [moved] = next.splice(drag_index, 1);
    next.splice(target_index, 0, moved);
    set_drag_index(null);
    emit_approvers(next);
  };

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

            {/* Part 2 - "field equals value" conditions, built from this form's own fields.
                A choice field (a location field included) gets a dropdown of its own values. */}
            {wizard_step === 2 && (
              <>
                <p className="text-xs" style={{ color: GRAY, fontFamily: fontHeading }}>{translate("DCS_APPROVAL_CONDITIONS_HINT")}</p>
                {approvers.map((approver, index) => {
                  const conditions = approver.conditions || [];
                  const hidden_ids = hidden_condition_field_ids(conditions);
                  return (
                    <div key={index} className="p-4 space-y-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                      <ApproverBadge index={index} name={approver.name} translate={translate} />
                      {conditions.map((condition, condition_index) => {
                        // Ancestor conditions pinned by a trail pick stay data-only.
                        if (hidden_ids.has(condition.field_id)) return null;
                        const target_field = condition_fields.find((entry) => entry.id === condition.field_id);
                        const is_choice_field = !!target_field && CHOICE_FIELD_TYPES.includes(target_field.type);
                        // This approver's conditions on the levels above, so the control can
                        // tell which of several namesake entries is the selected one.
                        const location_siblings = (() => {
                          if (!target_field || !target_field.data_source || target_field.data_source.type !== "api") return undefined;
                          const by_level = ancestor_location_fields(target_field);
                          const values = {};
                          Object.entries(by_level).forEach(([level, ancestor_field]) => {
                            const sibling = conditions.find((entry, i) => i !== condition_index && entry.field_id === ancestor_field.id && entry.value);
                            if (sibling) values[level] = sibling.value;
                          });
                          return values;
                        })();
                        const is_location_field = !!target_field && !!target_field.data_source && target_field.data_source.type === "api";
                        const field_select = (
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
                        );
                        const remove_button = (
                          <button type="button" onClick={() => remove_condition(index, condition_index)}
                            className="inline-flex items-center justify-center p-2" style={{ color: DANGER }}>
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        );
                        // A location condition drills down level by level on its own row -
                        // the same flow as answering the form: province, then its districts,
                        // and so on until the field's own level.
                        if (is_location_field) {
                          return (
                            <div key={condition_index} className="p-3 space-y-2" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}` }}>
                              <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                                {field_select}
                                {remove_button}
                              </div>
                              <LocationTrailPicker
                                field_key={target_field.id}
                                api_level={target_field.data_source.level || "provinces"}
                                value={condition.value}
                                onChange={(next_value, picked) =>
                                  picked && Array.isArray(picked.path)
                                    ? handle_location_condition_pick(index, condition_index, target_field, next_value, picked)
                                    : handle_condition_change(index, condition_index, "value", next_value)
                                }
                                language={language}
                                sibling_values={location_siblings}
                              />
                            </div>
                          );
                        }
                        return (
                          <div key={condition_index} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                            {field_select}
                            {is_choice_field ? (
                              <ConditionValueControl
                                field={target_field}
                                value={condition.value}
                                onChange={(next_value) => handle_condition_change(index, condition_index, "value", next_value)}
                                resolveFullFieldOptions={resolveFullFieldOptions}
                                language={language}
                                placeholder={translate("DCS_APPROVAL_CONDITION_VALUE")}
                                filterPlaceholder={translate("DCS_APPROVAL_LOCATION_FILTER")}
                              />
                            ) : (
                              <input
                                type="text"
                                value={condition.value}
                                placeholder={translate("DCS_APPROVAL_CONDITION_VALUE")}
                                onChange={(event) => handle_condition_change(index, condition_index, "value", event.target.value)}
                                className={inputClassName}
                              />
                            )}
                            {remove_button}
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

            {/* Part 3 - drag to order, force and on-reject rules */}
            {wizard_step === 3 && (
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
                              {/* Hidden trail-pinned ancestors don't inflate the count */}
                              <FiFilter className="w-3 h-3" /> {conditions.filter((condition) => !hidden_condition_field_ids(conditions).has(condition.field_id)).length}
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

            {show_step_error && (!step_valid(wizard_step) || (wizard_step === 3 && !is_approval_config_complete({ enabled: true, approvers }))) && (
              <div className="p-3" style={{ backgroundColor: "#FDECEA", border: `1px solid ${DANGER}` }}>
                <p className="text-sm" style={{ color: DANGER, fontFamily: fontHeading }}>
                  {translate(wizard_step === 3 ? "DCS_APPROVAL_CONFIG_INCOMPLETE" : "DCS_APPROVAL_STEP_INCOMPLETE")}
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
                {wizard_step < 3 ? (
                  <button type="button" onClick={go_next} className="cok-btn-primary" style={{ flex: 1, fontFamily: fontHeading }}>
                    {translate("DCS_APPROVAL_NEXT")}
                  </button>
                ) : (
                  <button type="button" onClick={handle_save} disabled={saving}
                    className="cok-btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ flex: 1, fontFamily: fontHeading }}>
                    {saving ? (
                      <div className="animate-spin" style={{ width: 16, height: 16, border: `2px solid ${WHITE}`, borderTopColor: "transparent", borderRadius: "50%" }} />
                    ) : (
                      <><FiCheckCircle style={{ width: 16, height: 16 }} /> {translate("DCS_APPROVAL_SAVE")}</>
                    )}
                  </button>
                )}
              </div>
              {wizard_step === 3 && saved && (
                <div className="flex items-center justify-center gap-2 py-2 mt-3 text-sm font-semibold"
                  style={{ color: SUCCESS, fontFamily: fontHeading }}>
                  <FiCheckCircle className="w-4 h-4" />
                  {translate(onSave ? "DCS_APPROVAL_SAVED" : "DCS_APPROVAL_WIZARD_READY")}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
