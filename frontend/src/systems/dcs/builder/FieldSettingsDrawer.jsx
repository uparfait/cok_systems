import React, { useState, useEffect, useRef } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { dcs_translate } from "../i18n/index.js";
import { generate_field_id, DCS_FIELD_TYPE_REGISTRY, DCS_SELECT_LIKE_TYPES } from "../fields/fieldTypes.js";
import { build_validation_condition, DCS_VALIDATION_OPERATORS } from "./validationOperators.js";
import { DCS_FILE_TYPE_GROUPS } from "../fields/fileTypeGroups.js";
import { DCS_FILE_SIZE_UNITS } from "../fields/fileSizeLimit.js";
import { get_field_text, has_field_label, DCS_PARENT_GROUP_OPERATORS } from "../fields/fieldText.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsButtonOutlineReverse from "../components/DcsButtonOutlineReverse.jsx";
import ValidationRuleEditor from "./ValidationRuleEditor.jsx";

const LANGUAGES = ["en", "kn", "fr"];
const PARENT_GROUP_OPERATOR_LABEL_KEYS = {
  equals: "OP_EQUALS",
  not_equals: "OP_NOT_EQUALS",
  includes: "OP_INCLUDES",
  not_includes: "OP_NOT_INCLUDES",
  less_than: "OP_LESS_THAN",
  greater_than: "OP_GREATER_THAN",
};
const NON_LABEL_TYPES = ["paragraph", "file", "geolocation"];
const NON_INPUT_TYPES = ["paragraph", "header", "file", "group", "section"];
const OPTION_TYPES = ["single_select", "multi_select", "ranking", "select_group"];
const VISIBILITY_OPERATORS = DCS_VALIDATION_OPERATORS.filter((operator) => !operator.needsParent);
const FONT_FAMILIES = ["'Montserrat', sans-serif", "Arial, sans-serif", "Georgia, serif", "'Times New Roman', serif", "'Courier New', monospace"];
const LIST_TYPES = ["disc", "circle", "square", "decimal", "lower-roman", "upper-roman", "none"];
const IDEAL_PANEL_WIDTH = 760;
const DEFAULT_PANEL_HEIGHT = 500;
const MIN_PANEL_HEIGHT = 260;
const DEFAULT_LENGTH_LIMIT_UI = { unit: "characters", min: "", max: "", severity: "error" };
const LENGTH_LIMIT_MIN_RULE_ID = "length_limit_min_rule";
const LENGTH_LIMIT_MAX_RULE_ID = "length_limit_max_rule";
const MESSAGE_LANGUAGES = ["en", "kn", "fr"];

/**
 * A translated-text object for a length-limit message: resolves the
 * message key AND the "characters"/"words" unit word independently in each
 * of the three languages, so e.g. the French copy reads "caracteres" not
 * the English word interpolated into an otherwise-French sentence.
 */
function build_length_limit_message(message_key, unit_key, numeric_value) {
  const message = {};
  MESSAGE_LANGUAGES.forEach((language_code) => {
    const unit_text = dcs_translate(unit_key, language_code);
    message[language_code] = dcs_translate(message_key, language_code, { value: numeric_value, unit: unit_text });
  });
  return message;
}

// Lets one "Entered Data" line carry an explicit answer value alongside its
// label, e.g. "Two$::->2" -> label "Two", value "2" - without it, an item's
// value simply defaults to its own label text.
const VALUE_OVERRIDE_DELIMITER = "$::->";

/**
 * Splits one "Entered Data" quick-entry line into its individual raw
 * entries - comma-separated, blank entries and surrounding whitespace
 * dropped so a trailing comma or extra spacing never produces a bogus
 * empty option.
 */
function split_entered_values(text) {
  return String(text || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Parses one raw entry into its label text and, when the
 * VALUE_OVERRIDE_DELIMITER is present, the explicit value the author typed
 * after it.
 */
function parse_entered_item(raw_item) {
  const delimiter_index = raw_item.indexOf(VALUE_OVERRIDE_DELIMITER);
  if (delimiter_index === -1) return { text: raw_item, explicit_value: null };
  return {
    text: raw_item.slice(0, delimiter_index).trim(),
    explicit_value: raw_item.slice(delimiter_index + VALUE_OVERRIDE_DELIMITER.length).trim() || null,
  };
}

/**
 * Rebuilds the option label authoring text (used to pre-fill "Entered
 * Data" when reopening a field, and to keep it in sync whenever an option
 * is added/edited/removed directly below instead) from the field's own
 * options array, one comma-joined line per language. A value that was
 * hand-typed away from its English label round-trips back in using the
 * same override syntax "Entered Data" itself accepts, so re-editing there
 * never silently loses it.
 */
function build_entered_data_from_options(options) {
  const list = options || [];
  return {
    en: list
      .map((option) => {
        const text = (option.label && option.label.en) || "";
        return option.value && option.value !== text ? `${text}${VALUE_OVERRIDE_DELIMITER}${option.value}` : text;
      })
      .join(", "),
    kn: list.map((option) => (option.label && option.label.kn) || "").join(", "),
    fr: list.map((option) => (option.label && option.label.fr) || "").join(", "),
  };
}

/**
 * Derives the min/max length_limit_ui quick-setup into its two underlying
 * validation_rules entries (min_length/max_length for characters,
 * min_words/max_words for words) - a blank min or max simply produces no
 * rule for that side. Fixed rule ids let this replace the same two entries
 * on every change without disturbing any other validation rules the author
 * added by hand in the Validation tab.
 */
function build_length_limit_rules(field_id, length_limit_ui) {
  const ui = length_limit_ui || DEFAULT_LENGTH_LIMIT_UI;
  const is_words = ui.unit === "words";
  const unit_key = is_words ? "DCS_UNIT_WORDS" : "DCS_UNIT_CHARACTERS";
  const rules = [];

  if (ui.min !== "" && ui.min !== null && ui.min !== undefined) {
    const operator = is_words ? "min_words" : "min_length";
    rules.push({
      id: LENGTH_LIMIT_MIN_RULE_ID,
      operator,
      value: ui.min,
      parent_field_id: null,
      parent_value: "",
      message: build_length_limit_message("DCS_VALIDATION_LENGTH_LIMIT_MIN_MESSAGE", unit_key, ui.min),
      valid_message: { en: "", kn: "", fr: "" },
      severity: ui.severity || "error",
      condition: build_validation_condition(field_id, operator, ui.min),
    });
  }

  if (ui.max !== "" && ui.max !== null && ui.max !== undefined) {
    const operator = is_words ? "max_words" : "max_length";
    rules.push({
      id: LENGTH_LIMIT_MAX_RULE_ID,
      operator,
      value: ui.max,
      parent_field_id: null,
      parent_value: "",
      message: build_length_limit_message("DCS_VALIDATION_LENGTH_LIMIT_MAX_MESSAGE", unit_key, ui.max),
      valid_message: { en: "", kn: "", fr: "" },
      severity: ui.severity || "error",
      condition: build_validation_condition(field_id, operator, ui.max),
    });
  }

  return rules;
}

/**
 * Wide enough that no label, button or select ever wraps mid-word, but
 * clamped so it never overflows a narrow viewport.
 */
function get_panel_width() {
  return Math.min(IDEAL_PANEL_WIDTH, window.innerWidth - 16);
}

/**
 * Translated three-language input row shared by every text setting below.
 */
function TranslatedTextRow({ labelKey, value, onChange, translate }) {
  return (
    <div>
      <label className="cok-auth-label">{translate(labelKey)}</label>
      <div className="space-y-2">
        {LANGUAGES.map((language_code) => (
          <input
            key={language_code}
            className="cok-auth-input w-full py-3"
            placeholder={language_code.toUpperCase()}
            value={(value && value[language_code]) || ""}
            onChange={(event) => onChange(Object.assign({}, value, { [language_code]: event.target.value }))}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Read-only display of a parent field's own validation rules, shown inside
 * the Conditional Visibility tab so an author always sees the full
 * dependency chain instead of just the child's condition.
 */
function ParentValidationSummary({ parentField, translate }) {
  const rules = (parentField && parentField.validation_rules) || [];
  if (!parentField || rules.length === 0) return null;

  return (
    <div className="mt-3 border p-3 space-y-2" style={{ borderColor: "#E0E0E0", backgroundColor: "#F7F9FB" }}>
      <p className="text-xs font-semibold uppercase" style={{ color: "#9E9E9E", letterSpacing: "0.5px" }}>
        {translate("DCS_SETTINGS_PARENT_VALIDATIONS_TITLE")}
      </p>
      {rules.map((rule) => (
        <div key={rule.id} className="text-xs" style={{ color: "#555555" }}>
          <span className="font-semibold">{translate(`OP_${rule.operator}`.toUpperCase())}</span>
          {rule.value ? ` "${rule.value}"` : ""} - {get_field_text(rule.message, "en") || "-"}
          <span className="ml-1" style={{ color: rule.severity === "warning" ? "#F39C12" : "#E74C3C" }}>
            ({translate(rule.severity === "warning" ? "DCS_SETTINGS_SEVERITY_WARNING" : "DCS_SETTINGS_SEVERITY_ERROR")})
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Computes where the flying settings popover should sit relative to the
 * button that opened it, clamped so the whole panel (at its default
 * height) always lands fully on screen - never clipped below the
 * viewport - while still starting as close to the opener as possible.
 */
function compute_initial_position(anchorRect) {
  const panel_width = get_panel_width();
  const max_left = Math.max(8, window.innerWidth - panel_width - 8);
  const max_top = Math.max(8, window.innerHeight - DEFAULT_PANEL_HEIGHT - 8);

  if (!anchorRect) {
    return { top: Math.min(80, max_top), left: Math.min(Math.max(8, window.innerWidth / 2 - panel_width / 2), max_left) };
  }

  const left = Math.min(Math.max(8, anchorRect.left), max_left);
  const top = Math.min(Math.max(8, anchorRect.bottom + 8), max_top);
  return { top, left };
}

/**
 * Flying, anchored settings popover for a single field - opens just below
 * the gear button that triggered it (no dimmed backdrop), with a compact
 * left-hand tab rail: Labels, Validation Criterion, Designs and Conditional
 * Visibility. Form design components (header, paragraph, file, image,
 * horizontal line) only ever show Designs and Conditional Visibility,
 * since their own content is authored inline in the canvas.
 */
export default function FieldSettingsDrawer({ field, allFields, onSave, onClose, anchorRect, fieldErrorInfo }) {
  const { translate } = useDcsLanguage();
  const [draft, setDraft] = useState(field);
  const [entered_data, setEnteredData] = useState(() => build_entered_data_from_options(field.options));
  // Same Entered Data convenience as the flat options editor, but one per
  // parent-option-group (keyed by the group's own id) - a group not yet
  // present here just falls back to whatever build_entered_data_from_options
  // derives live from its current options.
  const [group_entered_data, setGroupEnteredData] = useState({});
  const [position, setPosition] = useState(() => compute_initial_position(anchorRect));
  const [panel_height, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT);
  const panel_ref = useRef(null);
  const drag_state_ref = useRef(null);

  const registry_entry = DCS_FIELD_TYPE_REGISTRY.find((entry) => entry.type === draft.type);
  const is_content_field = registry_entry ? registry_entry.category === "content" : false;
  // GeoLocation's answer is auto-detected/reverse-geocoded, and a group is
  // purely an organizational wrapper around its own children - neither one
  // is itself something an author would author a validation rule against,
  // so neither ever needs (or offers) the Validation tab, content fields
  // aside.
  const NO_VALIDATION_TYPES = ["geolocation", "group"];
  // Any type that authors its own answer options (or, for cascading_select,
  // a parent-driven equivalent) gets its own "Answer options" tab, kept
  // separate from Labels so that tab's growing "Quick entry" + options list
  // doesn't crowd out the field's other everyday settings.
  const has_options_tab = OPTION_TYPES.includes(draft.type) || draft.type === "cascading_select";
  const tabs = is_content_field
    ? ["designs", "visibility"]
    : NO_VALIDATION_TYPES.includes(draft.type)
      ? (has_options_tab ? ["labels", "options", "designs", "visibility"] : ["labels", "designs", "visibility"])
      : (has_options_tab ? ["labels", "options", "validation", "designs", "visibility"] : ["labels", "validation", "designs", "visibility"]);
  const [active_tab, setActiveTab] = useState(tabs[0]);
  const has_field_errors = !!(fieldErrorInfo && fieldErrorInfo.messages.length > 0);

  useEffect(() => {
    setDraft(field);
    setEnteredData(build_entered_data_from_options(field.options));
    setGroupEnteredData({});
    // Jump straight to whichever tab the last failed publish attempt
    // actually pointed at, rather than always Labels - the point of
    // highlighting an error at all is to save the author from hunting for
    // it across four tabs themselves.
    const first_error_tab = fieldErrorInfo && fieldErrorInfo.tabs_with_errors.size > 0
      ? tabs.find((tab_id) => fieldErrorInfo.tabs_with_errors.has(tab_id))
      : null;
    setActiveTab(first_error_tab || tabs[0]);
    setPosition(compute_initial_position(anchorRect));
    setPanelHeight(DEFAULT_PANEL_HEIGHT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.id]);

  useEffect(() => {
    const handle_drag_move = (event) => {
      const drag_state = drag_state_ref.current;
      if (!drag_state) return;
      setPosition({
        top: drag_state.start_top + (event.clientY - drag_state.start_mouse_y),
        left: drag_state.start_left + (event.clientX - drag_state.start_mouse_x),
      });
    };
    const handle_drag_end = () => {
      drag_state_ref.current = null;
    };
    document.addEventListener("mousemove", handle_drag_move);
    document.addEventListener("mouseup", handle_drag_end);
    return () => {
      document.removeEventListener("mousemove", handle_drag_move);
      document.removeEventListener("mouseup", handle_drag_end);
    };
  }, []);

  const handle_header_mouse_down = (event) => {
    if (event.target.closest("button")) return;
    drag_state_ref.current = {
      start_mouse_x: event.clientX,
      start_mouse_y: event.clientY,
      start_top: position.top,
      start_left: position.left,
    };
  };

  const update = (patch) => setDraft((previous) => Object.assign({}, previous, patch));
  const update_design = (patch) => setDraft((previous) => Object.assign({}, previous, { design: Object.assign({}, previous.design || {}, patch) }));

  const has_label = !NON_LABEL_TYPES.includes(draft.type);
  const is_input_field = !NON_INPUT_TYPES.includes(draft.type) && !is_content_field;
  const has_options = OPTION_TYPES.includes(draft.type);
  const is_cascading = draft.type === "cascading_select";
  const supports_entered_data = ["single_select", "multi_select", "select_group", "cascading_select"].includes(draft.type);
  // Single/multi select and select group may optionally split their own
  // options into parent-driven condition groups (see
  // get_field_options_state) instead of one flat list - cascading_select
  // already has its own, simpler, single-parent mechanism and keeps it.
  const supports_parent_groups = ["single_select", "multi_select", "select_group"].includes(draft.type);
  const is_hidden = draft.type === "hidden";
  const is_header = draft.type === "header";
  const is_paragraph = draft.type === "paragraph";
  const is_likert = draft.type === "likert_scale";
  const is_media = ["image", "video", "audio", "file_upload"].includes(draft.type);
  const is_large_text = draft.type === "large_text";
  const is_placeholder_capable = ["text", "large_text", "number", "email", "url", "phone"].includes(draft.type);
  const is_date_like = ["date", "date_time"].includes(draft.type);
  const is_horizontal_line = draft.type === "horizontal_line";
  const design = draft.design || {};
  const length_limit_ui = draft.length_limit_ui || DEFAULT_LENGTH_LIMIT_UI;
  const other_fields = (allFields || []).filter((candidate_field) => candidate_field.id !== draft.id && has_field_label(candidate_field));

  const labels_tab_errors = (fieldErrorInfo && fieldErrorInfo.tab_messages.labels) || [];
  const options_tab_errors = (fieldErrorInfo && fieldErrorInfo.tab_messages.options) || [];
  const label_required_error = labels_tab_errors.find((entry) => entry.reason === "field_label_required");
  const options_required_error = options_tab_errors.find((entry) => entry.reason === "options_required");
  const cascading_parent_error = labels_tab_errors.find(
    (entry) => entry.reason === "cascading_parent_field_id_not_found" || entry.reason === "cascading_parent_field_id_self_reference",
  );
  const computed_formula_error = labels_tab_errors.find((entry) => entry.reason.startsWith("computed_formula_"));
  const visibility_tab_errors = (fieldErrorInfo && fieldErrorInfo.tab_messages.visibility) || [];
  const rule_errors_by_index = (fieldErrorInfo && fieldErrorInfo.rule_errors) || {};
  const option_errors_by_index = (fieldErrorInfo && fieldErrorInfo.option_errors) || {};

  // Every mutation to draft.options made directly below (add/edit/remove)
  // also refreshes the "Entered Data" quick-entry lines to match - so
  // editing an option by hand and then glancing back up at Entered Data
  // never shows stale text, and typing there afterward regenerates from
  // what is actually now on screen rather than what was there when the
  // drawer first opened.
  const apply_options = (next_options) => {
    update({ options: next_options });
    setEnteredData(build_entered_data_from_options(next_options));
  };

  const add_option = () => {
    const new_option_id = generate_field_id("option");
    const next_options = (draft.options || []).concat([
      { id: new_option_id, label: { en: "", kn: "", fr: "" }, value: "", parent_value: is_cascading ? "" : undefined },
    ]);
    apply_options(next_options);
  };

  const update_option = (option_id, patch) => {
    apply_options(draft.options.map((option) => (option.id === option_id ? Object.assign({}, option, patch) : option)));
  };

  // The English label specifically doubles as the answer value by
  // default - typing it fills "value" in step, right up until the author
  // types their own value directly (tracked simply by whether the current
  // value has already drifted away from the previous English label), at
  // which point their own choice is left alone from then on.
  const update_option_label = (option, language_code, text) => {
    const patch = { label: Object.assign({}, option.label, { [language_code]: text }) };
    if (language_code === "en") {
      const previous_en = (option.label && option.label.en) || "";
      const value_still_in_sync = !option.value || option.value === previous_en;
      if (value_still_in_sync) patch.value = text;
    }
    update_option(option.id, patch);
  };

  const remove_option = (option_id) => {
    apply_options(draft.options.filter((option) => option.id !== option_id));
  };

  // Everything below manages field.parent_option_groups - single/multi
  // select and select group's alternative to a flat option list, only
  // relevant while draft.parent_dependency_enabled is true (see
  // get_field_options_state for how it resolves at answer time).
  const update_parent_option_groups = (next_groups) => update({ parent_option_groups: next_groups });

  const build_blank_group_option = () => ({ id: generate_field_id("option"), label: { en: "", kn: "", fr: "" }, value: "" });

  const add_parent_option_group = () => {
    update_parent_option_groups(
      (draft.parent_option_groups || []).concat([
        { id: generate_field_id("group"), parent_field_id: "", operator: "equals", value: "", options: [build_blank_group_option()] },
      ]),
    );
  };

  const update_parent_option_group = (group_id, patch) => {
    update_parent_option_groups((draft.parent_option_groups || []).map((group) => (group.id === group_id ? Object.assign({}, group, patch) : group)));
  };

  const remove_parent_option_group = (group_id) => {
    update_parent_option_groups((draft.parent_option_groups || []).filter((group) => group.id !== group_id));
  };

  // Every mutation to one group's own options (add/edit/remove, mirroring
  // apply_options for the flat editor) also refreshes that group's own
  // Entered Data lines to match.
  const apply_group_options = (group, next_options) => {
    update_parent_option_group(group.id, { options: next_options });
    setGroupEnteredData((previous) => Object.assign({}, previous, { [group.id]: build_entered_data_from_options(next_options) }));
  };

  const add_group_option = (group) => {
    apply_group_options(group, (group.options || []).concat([build_blank_group_option()]));
  };

  const update_group_option = (group, option_id, patch) => {
    apply_group_options(group, (group.options || []).map((option) => (option.id === option_id ? Object.assign({}, option, patch) : option)));
  };

  // Same English-label-doubles-as-value convenience as the flat options
  // editor's own update_option_label.
  const update_group_option_label = (group, option, language_code, text) => {
    const patch = { label: Object.assign({}, option.label, { [language_code]: text }) };
    if (language_code === "en") {
      const previous_en = (option.label && option.label.en) || "";
      const value_still_in_sync = !option.value || option.value === previous_en;
      if (value_still_in_sync) patch.value = text;
    }
    update_group_option(group, option.id, patch);
  };

  const remove_group_option = (group, option_id) => {
    apply_group_options(group, (group.options || []).filter((option) => option.id !== option_id));
  };

  const get_group_entered_data = (group) =>
    group_entered_data[group.id] !== undefined ? group_entered_data[group.id] : build_entered_data_from_options(group.options);

  // Same Quick Entry mechanism as update_entered_data, scoped to one
  // group's own options instead of the field's flat top-level list.
  const update_group_entered_data = (group, language_code, text) => {
    const current = get_group_entered_data(group);
    const next_entered_data = Object.assign({}, current, { [language_code]: text });
    setGroupEnteredData((previous) => Object.assign({}, previous, { [group.id]: next_entered_data }));

    const items_by_language = {
      en: split_entered_values(next_entered_data.en).map(parse_entered_item),
      kn: split_entered_values(next_entered_data.kn).map(parse_entered_item),
      fr: split_entered_values(next_entered_data.fr).map(parse_entered_item),
    };
    const option_count = Math.max(items_by_language.en.length, items_by_language.kn.length, items_by_language.fr.length);
    if (option_count === 0) return;

    const existing_options = group.options || [];
    const blank_item = { text: "", explicit_value: null };
    const next_options = [];
    for (let index = 0; index < option_count; index += 1) {
      const en_item = items_by_language.en[index] || blank_item;
      const kn_item = items_by_language.kn[index] || blank_item;
      const fr_item = items_by_language.fr[index] || blank_item;
      const existing_option = existing_options[index];
      const option_id = (existing_option && existing_option.id) || generate_field_id("option");
      const explicit_value = en_item.explicit_value || kn_item.explicit_value || fr_item.explicit_value;
      const default_value = en_item.text || kn_item.text || fr_item.text || "";
      next_options.push({ id: option_id, label: { en: en_item.text, kn: kn_item.text, fr: fr_item.text }, value: explicit_value || default_value });
    }
    update_parent_option_group(group.id, { options: next_options });
  };

  // Purely a client-side authoring shortcut - three comma-separated,
  // position-matched lines (one per language) regenerate the whole options
  // array below on every keystroke; an item may carry its own explicit
  // value via VALUE_OVERRIDE_DELIMITER (e.g. "Two$::->2"), otherwise the
  // value defaults to whatever the author typed as the label - English
  // first, falling back to whichever language is available - never an
  // opaque generated id. Never saved on its own (the schema only ever
  // carries the resulting "options"), and editing an option by hand below
  // keeps this in sync too (see apply_options).
  const update_entered_data = (language_code, text) => {
    const next_entered_data = Object.assign({}, entered_data, { [language_code]: text });
    setEnteredData(next_entered_data);

    const items_by_language = {
      en: split_entered_values(next_entered_data.en).map(parse_entered_item),
      kn: split_entered_values(next_entered_data.kn).map(parse_entered_item),
      fr: split_entered_values(next_entered_data.fr).map(parse_entered_item),
    };
    const option_count = Math.max(items_by_language.en.length, items_by_language.kn.length, items_by_language.fr.length);
    if (option_count === 0) return;

    const existing_options = draft.options || [];
    const blank_item = { text: "", explicit_value: null };
    const next_options = [];
    for (let index = 0; index < option_count; index += 1) {
      const en_item = items_by_language.en[index] || blank_item;
      const kn_item = items_by_language.kn[index] || blank_item;
      const fr_item = items_by_language.fr[index] || blank_item;
      const existing_option = existing_options[index];
      const option_id = (existing_option && existing_option.id) || generate_field_id("option");
      const explicit_value = en_item.explicit_value || kn_item.explicit_value || fr_item.explicit_value;
      // Never an opaque generated id - a position with no label text in
      // any language and no explicit override just gets a blank value,
      // full stop, exactly like a brand new option added by hand.
      const default_value = en_item.text || kn_item.text || fr_item.text || "";
      next_options.push(
        Object.assign(
          { id: option_id, label: { en: en_item.text, kn: kn_item.text, fr: fr_item.text }, value: explicit_value || default_value },
          is_cascading ? { parent_value: (existing_option && existing_option.parent_value) || "" } : {},
        ),
      );
    }
    update({ options: next_options });
  };

  // Regenerates the two fixed-id length-limit rules from the quick-setup
  // state on every change - editing the same threshold later in the
  // generic Validation tab is still possible, but the next quick-setup
  // edit here will overwrite it back to whatever this panel says.
  const update_length_limit = (patch) => {
    const next_ui = Object.assign({}, length_limit_ui, patch);
    const other_rules = (draft.validation_rules || []).filter(
      (rule) => rule.id !== LENGTH_LIMIT_MIN_RULE_ID && rule.id !== LENGTH_LIMIT_MAX_RULE_ID,
    );
    update({ length_limit_ui: next_ui, validation_rules: other_rules.concat(build_length_limit_rules(draft.id, next_ui)) });
  };

  const visibility_ui = draft.visibility_condition_ui || { parent_field_id: "", operator: "equals", value: "" };
  const visibility_parent_field = other_fields.find((candidate_field) => candidate_field.id === visibility_ui.parent_field_id);

  const update_visibility = (patch) => {
    const next_ui = Object.assign({}, visibility_ui, patch);
    const next_condition = next_ui.parent_field_id ? build_validation_condition(next_ui.parent_field_id, next_ui.operator, next_ui.value) : null;
    update({ visibility_condition_ui: next_ui, visibility_condition: next_condition });
  };

  const tab_labels = {
    labels: "DCS_SETTINGS_TAB_LABELS",
    options: "DCS_SETTINGS_TAB_OPTIONS",
    validation: "DCS_SETTINGS_TAB_VALIDATION",
    designs: "DCS_SETTINGS_TAB_DESIGNS",
    visibility: "DCS_SETTINGS_TAB_VISIBILITY",
  };

  return (
    <div
      ref={panel_ref}
      className="fixed z-[10000] bg-white flex flex-col shadow-lg border"
      style={{
        top: position.top,
        left: position.left,
        width: get_panel_width(),
        height: panel_height,
        minHeight: MIN_PANEL_HEIGHT,
        maxHeight: "95vh",
        resize: "vertical",
        overflow: "hidden",
        borderColor: "#E0E0E0",
      }}
      onMouseUp={() => setPanelHeight(panel_ref.current ? panel_ref.current.getBoundingClientRect().height : panel_height)}
    >
      <div
        className="cok-bg-primary px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{ cursor: "move" }}
        onMouseDown={handle_header_mouse_down}
      >
        <span className="text-white font-semibold uppercase tracking-wide text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          {translate("DCS_SETTINGS_TITLE")}
          {registry_entry && <span className="normal-case font-normal opacity-80"> - {translate(registry_entry.labelKey)}</span>}
        </span>
        <DcsButtonOutlineReverse onClick={onClose}>{translate("DCS_BTN_CLOSE")}</DcsButtonOutlineReverse>
      </div>

      {has_field_errors && (
        <div className="px-4 py-2 flex-shrink-0" style={{ backgroundColor: "rgba(231,76,60,0.1)" }}>
          {fieldErrorInfo.messages.map((message, index) => (
            <p key={index} className="text-xs" style={{ color: "#E74C3C", fontFamily: "'Montserrat', sans-serif" }}>
              {message}
            </p>
          ))}
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <div className="w-32 flex-shrink-0 border-r flex flex-col py-2 overflow-y-auto" style={{ borderColor: "#E0E0E0", backgroundColor: "#F7F9FB" }}>
          {tabs.map((tab_id) => (
            <button
              key={tab_id}
              type="button"
              onClick={() => setActiveTab(tab_id)}
              className="text-left px-3 py-2.5 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              style={{
                color: active_tab === tab_id ? "#056daa" : "#555555",
                backgroundColor: active_tab === tab_id ? "rgba(5,109,170,0.08)" : "transparent",
                borderLeft: active_tab === tab_id ? "3px solid #056daa" : "3px solid transparent",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              {translate(tab_labels[tab_id])}
              {fieldErrorInfo && fieldErrorInfo.tabs_with_errors.has(tab_id) && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#E74C3C", flexShrink: 0 }} />
              )}
            </button>
          ))}
        </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {active_tab === "labels" && (
            <>
              {has_label && (
                <div style={label_required_error ? { outline: "2px solid #E74C3C", outlineOffset: 4 } : undefined}>
                  <TranslatedTextRow labelKey="DCS_SETTINGS_LABEL" value={draft.label} onChange={(value) => update({ label: value })} translate={translate} />
                  {label_required_error && (
                    <p className="text-xs mt-1" style={{ color: "#E74C3C" }}>{label_required_error.message}</p>
                  )}
                </div>
              )}

              {is_input_field && !is_hidden && (
                <div className="flex items-center gap-4">
                  <label className="cok-auth-label mb-0">{translate("DCS_SETTINGS_MANDATORY")}</label>
                  <label className="flex items-center gap-1 text-sm">
                    <input type="radio" checked={!!draft.mandatory} onChange={() => update({ mandatory: true })} style={{ accentColor: "#056daa" }} />
                    {translate("DCS_SETTINGS_YES")}
                  </label>
                  <label className="flex items-center gap-1 text-sm">
                    <input type="radio" checked={!draft.mandatory} onChange={() => update({ mandatory: false })} style={{ accentColor: "#056daa" }} />
                    {translate("DCS_SETTINGS_NO")}
                  </label>
                </div>
              )}

              {is_placeholder_capable && (
                <TranslatedTextRow labelKey="DCS_SETTINGS_PLACEHOLDER" value={draft.placeholder} onChange={(value) => update({ placeholder: value })} translate={translate} />
              )}

              {is_input_field && !is_hidden && (
                <TranslatedTextRow labelKey="DCS_SETTINGS_HELP_TEXT" value={draft.help_text} onChange={(value) => update({ help_text: value })} translate={translate} />
              )}

              {is_input_field && !is_hidden && draft.mandatory && (
                <>
                  <TranslatedTextRow
                    labelKey="DCS_SETTINGS_MANDATORY_INVALID_MESSAGE"
                    value={draft.required_message}
                    onChange={(value) => update({ required_message: value })}
                    translate={translate}
                  />
                  <TranslatedTextRow
                    labelKey="DCS_SETTINGS_MANDATORY_VALID_MESSAGE"
                    value={draft.valid_message}
                    onChange={(value) => update({ valid_message: value })}
                    translate={translate}
                  />
                </>
              )}

              {is_media && (
                <div className="space-y-4">
                  <div>
                    <label className="cok-auth-label">{translate("DCS_SETTINGS_MAX_SIZE")}</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        className="cok-auth-input w-full py-3"
                        placeholder={translate("DCS_SETTINGS_UNLIMITED")}
                        value={draft.max_size_value ?? ""}
                        onChange={(event) => update({ max_size_value: event.target.value ? Number(event.target.value) : null })}
                      />
                      <select
                        className="cok-auth-input py-3"
                        style={{ flexShrink: 0, width: 90 }}
                        value={draft.max_size_unit || "mb"}
                        onChange={(event) => update({ max_size_unit: event.target.value })}
                      >
                        {DCS_FILE_SIZE_UNITS.map((unit) => (
                          <option key={unit.key} value={unit.key}>
                            {translate(unit.labelKey)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "#9E9E9E" }}>
                      {translate("DCS_SETTINGS_MAX_SIZE_HINT")}
                    </p>
                  </div>
                  <div>
                    <label className="cok-auth-label">{translate("DCS_SETTINGS_ALLOWED_FILE_TYPES")}</label>
                    <div className="space-y-1">
                      {DCS_FILE_TYPE_GROUPS.map((group) => {
                        const selected_groups = draft.allowed_file_type_groups || [];
                        const is_checked = selected_groups.includes(group.key);
                        return (
                          <label key={group.key} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={is_checked}
                              onChange={(event) =>
                                update({
                                  allowed_file_type_groups: event.target.checked
                                    ? selected_groups.concat([group.key])
                                    : selected_groups.filter((key) => key !== group.key),
                                })
                              }
                              style={{ accentColor: "#056daa" }}
                            />
                            {translate(group.labelKey)} ({group.extensions.join(", ")})
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs mt-1" style={{ color: "#9E9E9E" }}>
                      {translate("DCS_SETTINGS_ALLOWED_FILE_TYPES_HINT")}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!draft.allow_link_input}
                      onChange={(event) => update({ allow_link_input: event.target.checked })}
                      style={{ accentColor: "#056daa" }}
                    />
                    {translate("DCS_SETTINGS_ALLOW_LINK_INPUT")}
                  </label>
                </div>
              )}

              {is_date_like && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!draft.exclude_weekends} onChange={(event) => update({ exclude_weekends: event.target.checked })} style={{ accentColor: "#056daa" }} />
                  {translate("DCS_SETTINGS_EXCLUDE_WEEKENDS")}
                </label>
              )}

              {is_large_text && (
                <div className="space-y-3 border p-3" style={{ borderColor: "#E0E0E0" }}>
                  <div>
                    <label className="cok-auth-label">{translate("DCS_SETTINGS_ROWS")}</label>
                    <input
                      type="number"
                      min="2"
                      max="20"
                      className="cok-auth-input w-full py-2"
                      value={draft.rows || 5}
                      onChange={(event) => update({ rows: Number(event.target.value) })}
                    />
                  </div>

                  <label className="cok-auth-label mb-0">{translate("DCS_SETTINGS_LENGTH_LIMIT_TITLE")}</label>
                  <p className="text-xs" style={{ color: "#9E9E9E" }}>{translate("DCS_SETTINGS_LENGTH_LIMIT_HINT")}</p>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="radio"
                        checked={length_limit_ui.unit === "characters"}
                        onChange={() => update_length_limit({ unit: "characters" })}
                        style={{ accentColor: "#056daa" }}
                      />
                      {translate("DCS_SETTINGS_LENGTH_LIMIT_UNIT_CHARACTERS")}
                    </label>
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="radio"
                        checked={length_limit_ui.unit === "words"}
                        onChange={() => update_length_limit({ unit: "words" })}
                        style={{ accentColor: "#056daa" }}
                      />
                      {translate("DCS_SETTINGS_LENGTH_LIMIT_UNIT_WORDS")}
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="cok-auth-label">{translate("DCS_SETTINGS_LENGTH_LIMIT_MIN")}</label>
                      <input
                        type="number"
                        min="0"
                        className="cok-auth-input w-full py-2"
                        placeholder={translate("DCS_SETTINGS_UNLIMITED")}
                        value={length_limit_ui.min}
                        onChange={(event) => update_length_limit({ min: event.target.value })}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="cok-auth-label">{translate("DCS_SETTINGS_LENGTH_LIMIT_MAX")}</label>
                      <input
                        type="number"
                        min="0"
                        className="cok-auth-input w-full py-2"
                        placeholder={translate("DCS_SETTINGS_UNLIMITED")}
                        value={length_limit_ui.max}
                        onChange={(event) => update_length_limit({ max: event.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="cok-auth-label">{translate("DCS_SETTINGS_VALIDATION_SEVERITY")}</label>
                    <select
                      className="cok-auth-input w-full py-2"
                      value={length_limit_ui.severity}
                      onChange={(event) => update_length_limit({ severity: event.target.value })}
                    >
                      <option value="error">{translate("DCS_SETTINGS_SEVERITY_ERROR")}</option>
                      <option value="warning">{translate("DCS_SETTINGS_SEVERITY_WARNING")}</option>
                    </select>
                  </div>
                </div>
              )}

              {is_likert && (
                <>
                  <div>
                    <label className="cok-auth-label">{translate("DCS_SETTINGS_LIKERT_SCALE_SIZE")}</label>
                    <input type="number" min="2" max="10" className="cok-auth-input w-full py-2" value={draft.scale_size || 5} onChange={(event) => update({ scale_size: Number(event.target.value) })} />
                  </div>
                  <TranslatedTextRow labelKey="DCS_SETTINGS_LABEL" value={draft.low_label} onChange={(value) => update({ low_label: value })} translate={translate} />
                  <TranslatedTextRow labelKey="DCS_SETTINGS_LABEL" value={draft.high_label} onChange={(value) => update({ high_label: value })} translate={translate} />
                </>
              )}

              {is_hidden && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!(draft.computed && draft.computed.enabled)}
                      onChange={(event) => update({ computed: Object.assign({}, draft.computed, { enabled: event.target.checked }) })}
                      style={{ accentColor: "#056daa" }}
                    />
                    {translate("DCS_SETTINGS_COMPUTED_ENABLED")}
                  </label>
                  {draft.computed && draft.computed.enabled && (
                    <div style={computed_formula_error ? { outline: "2px solid #E74C3C", outlineOffset: 4 } : undefined}>
                      <label className="cok-auth-label">{translate("DCS_SETTINGS_COMPUTED_FORMULA")}</label>
                      <textarea
                        className="cok-auth-input w-full py-2"
                        rows={4}
                        value={draft.computed.formula_text || ""}
                        onChange={(event) => {
                          const formula_text = event.target.value;
                          let parsed_formula = draft.computed.formula;
                          try {
                            parsed_formula = JSON.parse(formula_text);
                          } catch (parse_error) {
                            parsed_formula = draft.computed.formula;
                          }
                          update({ computed: Object.assign({}, draft.computed, { formula_text, formula: parsed_formula }) });
                        }}
                      />
                      {computed_formula_error && (
                        <p className="text-xs mt-1" style={{ color: "#E74C3C" }}>{computed_formula_error.message}</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {active_tab === "options" && (
            <>
              {supports_parent_groups && (
                <div className="border p-3 space-y-2" style={{ borderColor: "#E0E0E0" }}>
                  <label className="cok-auth-label mb-0">{translate("DCS_SETTINGS_PARENT_DEPENDENCY_TOGGLE")}</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="radio"
                        checked={!draft.parent_dependency_enabled}
                        onChange={() => update({ parent_dependency_enabled: false })}
                        style={{ accentColor: "#056daa" }}
                      />
                      {translate("DCS_SETTINGS_NO")}
                    </label>
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="radio"
                        checked={!!draft.parent_dependency_enabled}
                        onChange={() => update({ parent_dependency_enabled: true })}
                        style={{ accentColor: "#056daa" }}
                      />
                      {translate("DCS_SETTINGS_YES")}
                    </label>
                  </div>
                  <p className="text-xs" style={{ color: "#9E9E9E" }}>{translate("DCS_SETTINGS_PARENT_DEPENDENCY_HINT")}</p>
                </div>
              )}

              {supports_parent_groups && draft.parent_dependency_enabled ? (
                <div className="space-y-3">
                  {(draft.parent_option_groups || []).map((group, group_index) => {
                    const group_parent_field = other_fields.find((candidate_field) => candidate_field.id === group.parent_field_id);
                    return (
                      <div key={group.id} className="border p-3 space-y-2" style={{ borderColor: "#E0E0E0" }}>
                        <p className="text-xs font-semibold uppercase" style={{ color: "#9E9E9E", letterSpacing: "0.5px" }}>
                          {translate("DCS_SETTINGS_GROUP_CONDITION_TITLE", { number: group_index + 1 })}
                        </p>
                        <div>
                          <label className="cok-auth-label">{translate("DCS_SETTINGS_PARENT_FIELD")}</label>
                          <select
                            className="cok-auth-input w-full py-2"
                            value={group.parent_field_id || ""}
                            onChange={(event) => update_parent_option_group(group.id, { parent_field_id: event.target.value, value: "" })}
                          >
                            <option value="">{translate("DCS_RENDERER_SELECT_PLACEHOLDER")}</option>
                            {other_fields.map((candidate_field) => (
                              <option key={candidate_field.id} value={candidate_field.id}>
                                {get_field_text(candidate_field.label, "en") || candidate_field.id}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="cok-auth-label">{translate("DCS_SETTINGS_VALIDATION_OPERATOR")}</label>
                          <select
                            className="cok-auth-input w-full py-2"
                            value={group.operator || "equals"}
                            onChange={(event) => update_parent_option_group(group.id, { operator: event.target.value })}
                          >
                            {DCS_PARENT_GROUP_OPERATORS.map((operator_id) => (
                              <option key={operator_id} value={operator_id}>
                                {translate(PARENT_GROUP_OPERATOR_LABEL_KEYS[operator_id])}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="cok-auth-label">{translate("DCS_SETTINGS_VALIDATION_VALUE")}</label>
                          {group_parent_field && DCS_SELECT_LIKE_TYPES.includes(group_parent_field.type) ? (
                            <select
                              className="cok-auth-input w-full py-2"
                              value={group.value}
                              onChange={(event) => update_parent_option_group(group.id, { value: event.target.value })}
                            >
                              <option value="">{translate("DCS_RENDERER_SELECT_PLACEHOLDER")}</option>
                              {(group_parent_field.options || []).map((option) => (
                                <option key={option.id} value={option.value}>
                                  {get_field_text(option.label, "en") || option.value}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="cok-auth-input w-full py-2"
                              value={group.value}
                              onChange={(event) => update_parent_option_group(group.id, { value: event.target.value })}
                            />
                          )}
                        </div>

                        {(() => {
                          const this_group_entered_data = get_group_entered_data(group);
                          return (
                            <div className="space-y-2 border p-2" style={{ borderColor: "#E0E0E0", backgroundColor: "#EFF4F8" }}>
                              <label className="cok-auth-label mb-0">{translate("DCS_SETTINGS_ENTERED_DATA_TITLE")}</label>
                              <p className="text-xs" style={{ color: "#9E9E9E" }}>{translate("DCS_SETTINGS_ENTERED_DATA_HINT")}</p>
                              <input
                                className="cok-auth-input w-full py-2"
                                placeholder={translate("DCS_SETTINGS_ENTERED_DATA_EN")}
                                value={this_group_entered_data.en}
                                onChange={(event) => update_group_entered_data(group, "en", event.target.value)}
                              />
                              <input
                                className="cok-auth-input w-full py-2"
                                placeholder={translate("DCS_SETTINGS_ENTERED_DATA_KN")}
                                value={this_group_entered_data.kn}
                                onChange={(event) => update_group_entered_data(group, "kn", event.target.value)}
                              />
                              <input
                                className="cok-auth-input w-full py-2"
                                placeholder={translate("DCS_SETTINGS_ENTERED_DATA_FR")}
                                value={this_group_entered_data.fr}
                                onChange={(event) => update_group_entered_data(group, "fr", event.target.value)}
                              />
                            </div>
                          );
                        })()}

                        <div className="border p-2 space-y-2" style={{ borderColor: "#E0E0E0", backgroundColor: "#F7F9FB" }}>
                          <label className="cok-auth-label">{translate("DCS_SETTINGS_GROUP_OPTIONS_TITLE")}</label>
                          {(group.options || []).map((option) => (
                            <div key={option.id} className="border p-2 space-y-2" style={{ borderColor: "#E0E0E0", backgroundColor: "#FFFFFF" }}>
                              {LANGUAGES.map((language_code) => (
                                <input
                                  key={language_code}
                                  className="cok-auth-input w-full py-2"
                                  placeholder={language_code.toUpperCase()}
                                  value={(option.label && option.label[language_code]) || ""}
                                  onChange={(event) => update_group_option_label(group, option, language_code, event.target.value)}
                                />
                              ))}
                              <input
                                className="cok-auth-input w-full py-2"
                                placeholder="value"
                                value={option.value}
                                onChange={(event) => update_group_option(group, option.id, { value: event.target.value })}
                              />
                              <DcsButtonOutline onClick={() => remove_group_option(group, option.id)}>{translate("DCS_SETTINGS_REMOVE")}</DcsButtonOutline>
                            </div>
                          ))}
                          <DcsButtonOutline onClick={() => add_group_option(group)}>{translate("DCS_SETTINGS_ADD_OPTION")}</DcsButtonOutline>
                        </div>

                        <DcsButtonOutline onClick={() => remove_parent_option_group(group.id)}>{translate("DCS_SETTINGS_REMOVE")}</DcsButtonOutline>
                      </div>
                    );
                  })}
                  <DcsButtonOutline className="w-full" onClick={add_parent_option_group}>{translate("DCS_SETTINGS_ADD_PARENT_GROUP")}</DcsButtonOutline>
                </div>
              ) : (
                <>
              {is_cascading && (
                <div style={cascading_parent_error ? { outline: "2px solid #E74C3C", outlineOffset: 4 } : undefined}>
                  <label className="cok-auth-label">{translate("DCS_SETTINGS_CASCADING_PARENT")}</label>
                  <select className="cok-auth-input w-full py-2" value={draft.parent_field_id || ""} onChange={(event) => update({ parent_field_id: event.target.value })}>
                    <option value="">{translate("DCS_RENDERER_SELECT_PLACEHOLDER")}</option>
                    {other_fields.map((candidate_field) => (
                      <option key={candidate_field.id} value={candidate_field.id}>
                        {get_field_text(candidate_field.label, "en") || candidate_field.id}
                      </option>
                    ))}
                  </select>
                  {cascading_parent_error && (
                    <p className="text-xs mt-1" style={{ color: "#E74C3C" }}>{cascading_parent_error.message}</p>
                  )}
                </div>
              )}

              {supports_entered_data && (
                <div className="space-y-2 border p-3" style={{ borderColor: "#E0E0E0", backgroundColor: "#F7F9FB" }}>
                  <label className="cok-auth-label mb-0">{translate("DCS_SETTINGS_ENTERED_DATA_TITLE")}</label>
                  <p className="text-xs" style={{ color: "#9E9E9E" }}>{translate("DCS_SETTINGS_ENTERED_DATA_HINT")}</p>
                  <div>
                    <label className="cok-auth-label">{translate("DCS_SETTINGS_ENTERED_DATA_EN")}</label>
                    <input
                      className="cok-auth-input w-full py-2"
                      placeholder={translate("DCS_SETTINGS_ENTERED_DATA_PLACEHOLDER")}
                      value={entered_data.en}
                      onChange={(event) => update_entered_data("en", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="cok-auth-label">{translate("DCS_SETTINGS_ENTERED_DATA_KN")}</label>
                    <input
                      className="cok-auth-input w-full py-2"
                      placeholder={translate("DCS_SETTINGS_ENTERED_DATA_PLACEHOLDER")}
                      value={entered_data.kn}
                      onChange={(event) => update_entered_data("kn", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="cok-auth-label">{translate("DCS_SETTINGS_ENTERED_DATA_FR")}</label>
                    <input
                      className="cok-auth-input w-full py-2"
                      placeholder={translate("DCS_SETTINGS_ENTERED_DATA_PLACEHOLDER")}
                      value={entered_data.fr}
                      onChange={(event) => update_entered_data("fr", event.target.value)}
                    />
                  </div>
                  {(draft.options || []).length > 0 && (
                    <p className="text-xs" style={{ color: "#056daa", wordBreak: "break-word" }}>
                      {(draft.options || [])
                        .map((option) => `${get_field_text(option.label, "en") || get_field_text(option.label, "kn") || get_field_text(option.label, "fr")}:${option.value}`)
                        .join(", ")}
                    </p>
                  )}
                </div>
              )}

              {(has_options || is_cascading) && (() => {
                const cascading_parent_field = is_cascading ? other_fields.find((candidate_field) => candidate_field.id === draft.parent_field_id) : null;
                return (
                <div>
                  <label className="cok-auth-label">{translate("DCS_SETTINGS_OPTIONS_TITLE")}</label>
                  {options_required_error && (
                    <p className="text-xs mb-2" style={{ color: "#E74C3C" }}>{options_required_error.message}</p>
                  )}
                  <div className="space-y-2">
                    {(draft.options || []).map((option, option_index) => {
                      const option_messages = option_errors_by_index[option_index] || [];
                      const option_has_error = option_messages.length > 0;
                      return (
                        <div
                          key={option.id}
                          className="border p-3 space-y-2"
                          style={{ borderColor: option_has_error ? "#E74C3C" : "#E0E0E0", backgroundColor: option_has_error ? "rgba(231,76,60,0.05)" : undefined }}
                        >
                          {LANGUAGES.map((language_code) => (
                            <input
                              key={language_code}
                              className="cok-auth-input w-full py-3"
                              placeholder={language_code.toUpperCase()}
                              value={(option.label && option.label[language_code]) || ""}
                              onChange={(event) => update_option_label(option, language_code, event.target.value)}
                            />
                          ))}
                          <input
                            className="cok-auth-input w-full py-3"
                            placeholder="value"
                            value={option.value}
                            onChange={(event) => update_option(option.id, { value: event.target.value })}
                          />
                          {is_cascading && (cascading_parent_field && DCS_SELECT_LIKE_TYPES.includes(cascading_parent_field.type) ? (
                            <select
                              className="cok-auth-input w-full py-3"
                              value={option.parent_value || ""}
                              onChange={(event) => update_option(option.id, { parent_value: event.target.value })}
                            >
                              <option value="">{translate("DCS_RENDERER_SELECT_PLACEHOLDER")}</option>
                              {(cascading_parent_field.options || []).map((parent_option) => (
                                <option key={parent_option.id} value={parent_option.value}>
                                  {get_field_text(parent_option.label, "en") || parent_option.value}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="cok-auth-input w-full py-3"
                              placeholder="parent value"
                              value={option.parent_value || ""}
                              onChange={(event) => update_option(option.id, { parent_value: event.target.value })}
                            />
                          ))}
                          {option_messages.map((message, message_index) => (
                            <p key={message_index} className="text-xs" style={{ color: "#E74C3C" }}>{message}</p>
                          ))}
                          <DcsButtonOutline onClick={() => remove_option(option.id)}>{translate("DCS_SETTINGS_REMOVE")}</DcsButtonOutline>
                        </div>
                      );
                    })}
                    <DcsButtonOutline onClick={add_option}>{translate("DCS_SETTINGS_ADD_OPTION")}</DcsButtonOutline>
                  </div>
                </div>
                );
              })()}
                </>
              )}
            </>
          )}

          {active_tab === "validation" && is_input_field && (
            <ValidationRuleEditor field={draft} allFields={other_fields} onChange={(rules) => update({ validation_rules: rules })} ruleErrors={rule_errors_by_index} />
          )}

          {active_tab === "designs" && (
            <div className="space-y-4">
              <div>
                <label className="cok-auth-label">{translate("DCS_DESIGN_SPACING_BELOW")}</label>
                <input
                  type="number"
                  min="0"
                  max="2000"
                  className="cok-auth-input w-full py-2"
                  value={design.spacing_below_px === undefined ? 16 : design.spacing_below_px}
                  onChange={(event) => update_design({ spacing_below_px: Number(event.target.value) })}
                />
              </div>

              {is_content_field && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!design.full_device_width}
                      onChange={(event) => update_design({ full_device_width: event.target.checked })}
                      style={{ accentColor: "#056daa" }}
                    />
                    {translate("DCS_DESIGN_FULL_DEVICE_WIDTH")}
                  </label>
                  {!design.full_device_width && (
                    <p className="text-xs" style={{ color: "#9E9E9E" }}>
                      {translate("DCS_DESIGN_POSITION_HINT")}
                    </p>
                  )}
                </>
              )}

              {is_header && (
                <div>
                  <label className="cok-auth-label">{translate("DCS_DESIGN_HEADING_TYPE")}</label>
                  <select className="cok-auth-input w-full py-2" value={draft.level || 2} onChange={(event) => update({ level: Number(event.target.value) })}>
                    {[1, 2, 3, 4, 5, 6].map((level_value) => (
                      <option key={level_value} value={level_value}>
                        {translate("DCS_DESIGN_HEADING_LEVEL", { level: level_value })}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(is_header || is_paragraph) && (
                <>
                  <div>
                    <label className="cok-auth-label">{translate("DCS_DESIGN_TEXT_COLOR")}</label>
                    <input type="color" className="w-full h-10" value={design.text_color || "#333333"} onChange={(event) => update_design({ text_color: event.target.value })} />
                  </div>
                  <div>
                    <label className="cok-auth-label">{translate("DCS_DESIGN_FONT_FAMILY")}</label>
                    <select className="cok-auth-input w-full py-2" value={design.font_family || FONT_FAMILIES[0]} onChange={(event) => update_design({ font_family: event.target.value })}>
                      {FONT_FAMILIES.map((font_family) => (
                        <option key={font_family} value={font_family} style={{ fontFamily: font_family }}>
                          {font_family.split(",")[0].replace(/'/g, "")}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {is_paragraph && (
                <div>
                  <label className="cok-auth-label">{translate("DCS_DESIGN_LIST_TYPE")}</label>
                  <select className="cok-auth-input w-full py-2" value={design.list_type || "disc"} onChange={(event) => update_design({ list_type: event.target.value })}>
                    {LIST_TYPES.map((list_type) => (
                      <option key={list_type} value={list_type}>
                        {translate(`DCS_DESIGN_LIST_TYPE_${list_type.replace("-", "_").toUpperCase()}`)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {is_horizontal_line ? (
                <div>
                  <label className="cok-auth-label">{translate("DCS_DESIGN_LINE_COLOR")}</label>
                  <input type="color" className="w-full h-10" value={design.border_color || "#E0E0E0"} onChange={(event) => update_design({ border_color: event.target.value })} />
                </div>
              ) : (
                <>
                  <div>
                    <label className="cok-auth-label">{translate("DCS_DESIGN_BACKGROUND_COLOR")}</label>
                    <input type="color" className="w-full h-10" value={design.background_color || "#FFFFFF"} onChange={(event) => update_design({ background_color: event.target.value })} />
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!design.border_enabled} onChange={(event) => update_design({ border_enabled: event.target.checked })} style={{ accentColor: "#056daa" }} />
                    {translate("DCS_DESIGN_BORDER_ENABLED")}
                  </label>
                  {design.border_enabled && (
                    <>
                      <div>
                        <label className="cok-auth-label">{translate("DCS_DESIGN_BORDER_COLOR")}</label>
                        <input type="color" className="w-full h-10" value={design.border_color || "#E0E0E0"} onChange={(event) => update_design({ border_color: event.target.value })} />
                      </div>
                      <div>
                        <label className="cok-auth-label">{translate("DCS_DESIGN_BORDER_WIDTH")}</label>
                        <input type="number" min="1" max="10" className="cok-auth-input w-full py-2" value={design.border_width || 1} onChange={(event) => update_design({ border_width: Number(event.target.value) })} />
                      </div>
                    </>
                  )}
                </>
              )}

              {is_horizontal_line && (
                <div>
                  <label className="cok-auth-label">{translate("DCS_DESIGN_THICKNESS")}</label>
                  <input type="number" min="1" max="20" className="cok-auth-input w-full py-2" value={draft.thickness_px || 2} onChange={(event) => update({ thickness_px: Number(event.target.value) })} />
                </div>
              )}
            </div>
          )}

          {active_tab === "visibility" && (
            <div>
              <p className="text-xs mb-3" style={{ color: "#9E9E9E" }}>
                {translate("DCS_SETTINGS_VISIBILITY_DESCRIPTION")}
              </p>
              <div className="space-y-3" style={visibility_tab_errors.length > 0 ? { outline: "2px solid #E74C3C", outlineOffset: 4 } : undefined}>
                <select className="cok-auth-input w-full py-3" value={visibility_ui.parent_field_id} onChange={(event) => update_visibility({ parent_field_id: event.target.value })}>
                  <option value="">{translate("DCS_RENDERER_SELECT_PLACEHOLDER")}</option>
                  {other_fields.map((candidate_field) => (
                    <option key={candidate_field.id} value={candidate_field.id}>
                      {get_field_text(candidate_field.label, "en") || candidate_field.id}
                    </option>
                  ))}
                </select>
                <select className="cok-auth-input w-full py-3" value={visibility_ui.operator} onChange={(event) => update_visibility({ operator: event.target.value })}>
                  {VISIBILITY_OPERATORS.map((operator) => (
                    <option key={operator.id} value={operator.id}>
                      {translate(operator.labelKey)}
                    </option>
                  ))}
                </select>
                {visibility_parent_field && DCS_SELECT_LIKE_TYPES.includes(visibility_parent_field.type) ? (
                  <select className="cok-auth-input w-full py-3" value={visibility_ui.value} onChange={(event) => update_visibility({ value: event.target.value })}>
                    <option value="">{translate("DCS_RENDERER_SELECT_PLACEHOLDER")}</option>
                    {(visibility_parent_field.options || []).map((option) => (
                      <option key={option.id} value={option.value}>
                        {get_field_text(option.label, "en") || option.value}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className="cok-auth-input w-full py-3" value={visibility_ui.value} onChange={(event) => update_visibility({ value: event.target.value })} />
                )}
              </div>
              {visibility_tab_errors.map((entry, index) => (
                <p key={index} className="text-xs mt-1" style={{ color: "#E74C3C" }}>{entry.message}</p>
              ))}
              <ParentValidationSummary parentField={visibility_parent_field} translate={translate} />
            </div>
          )}
        </div>

        <div className="p-3 border-t flex gap-3 flex-shrink-0" style={{ borderColor: "#E0E0E0" }}>
          <DcsButtonOutlineReverse className="flex-1" onClick={onClose}>
            {translate("DCS_BTN_CANCEL")}
          </DcsButtonOutlineReverse>
          <DcsButtonPrimary className="flex-1" onClick={() => onSave(draft)}>
            {translate("DCS_BTN_SAVE")}
          </DcsButtonPrimary>
        </div>
      </div>
      </div>
    </div>
  );
}
