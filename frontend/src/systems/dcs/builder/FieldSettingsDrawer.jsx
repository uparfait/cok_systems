import React, { useState, useEffect } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { generate_field_id } from "../fields/fieldTypes.js";
import { build_validation_condition, DCS_VALIDATION_OPERATORS } from "./validationOperators.js";
import { get_field_text, has_field_label } from "../fields/fieldText.js";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsButtonOutlineReverse from "../components/DcsButtonOutlineReverse.jsx";
import ValidationRuleEditor from "./ValidationRuleEditor.jsx";

const LANGUAGES = ["en", "kn", "fr"];
const NON_LABEL_TYPES = ["paragraph", "file"];
const NON_INPUT_TYPES = ["paragraph", "header", "file", "group"];
const OPTION_TYPES = ["single_select", "multi_select", "ranking"];
const VISIBILITY_OPERATORS = DCS_VALIDATION_OPERATORS.filter((operator) => operator.id !== "depends_on_parent");

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
 * Slide-over panel where every configuration for a single field lives:
 * translated text, mandatory/default response, type-specific bounds,
 * options, validation rules and conditional visibility.
 */
export default function FieldSettingsDrawer({ field, allFields, onSave, onClose }) {
  const { translate } = useDcsLanguage();
  const [draft, setDraft] = useState(field);

  useEffect(() => setDraft(field), [field.id]);

  const update = (patch) => setDraft((previous) => Object.assign({}, previous, patch));

  const has_label = !NON_LABEL_TYPES.includes(draft.type);
  const is_input_field = !NON_INPUT_TYPES.includes(draft.type);
  const has_options = OPTION_TYPES.includes(draft.type);
  const is_cascading = draft.type === "cascading_select";
  const is_hidden = draft.type === "hidden";
  const is_header = draft.type === "header";
  const is_likert = draft.type === "likert_scale";
  const is_media = ["image", "video", "audio", "file_upload"].includes(draft.type);
  const is_number = draft.type === "number";
  const is_text = draft.type === "text";
  const is_date_like = ["date", "date_time"].includes(draft.type);
  const other_fields = (allFields || []).filter((candidate_field) => candidate_field.id !== draft.id && has_field_label(candidate_field));

  const add_option = () => {
    const next_options = (draft.options || []).concat([
      { id: generate_field_id("option"), label: { en: "", kn: "", fr: "" }, value: "", parent_value: is_cascading ? "" : undefined },
    ]);
    update({ options: next_options });
  };

  const update_option = (option_id, patch) => {
    update({ options: draft.options.map((option) => (option.id === option_id ? Object.assign({}, option, patch) : option)) });
  };

  const remove_option = (option_id) => {
    update({ options: draft.options.filter((option) => option.id !== option_id) });
  };

  const visibility_ui = draft.visibility_condition_ui || { parent_field_id: "", operator: "equals", value: "" };

  const update_visibility = (patch) => {
    const next_ui = Object.assign({}, visibility_ui, patch);
    const next_condition = next_ui.parent_field_id ? build_validation_condition(next_ui.parent_field_id, next_ui.operator, next_ui.value) : null;
    update({ visibility_condition_ui: next_ui, visibility_condition: next_condition });
  };

  return (
    <div className="fixed inset-0 z-[10000] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full flex flex-col border-2" style={{ borderColor: "#E0E0E0" }}>
        <div className="cok-bg-primary px-4 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-white font-semibold uppercase tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_SETTINGS_TITLE")}
          </span>
          <DcsButtonOutlineReverse onClick={onClose}>{translate("DCS_BTN_CLOSE")}</DcsButtonOutlineReverse>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {has_label && (
            <TranslatedTextRow labelKey="DCS_SETTINGS_LABEL" value={draft.label} onChange={(value) => update({ label: value })} translate={translate} />
          )}

          {is_header && (
            <div>
              <label className="cok-auth-label">{translate("FIELD_TYPE_HEADER")}</label>
              <select className="cok-auth-input w-full py-2" value={draft.level || 2} onChange={(event) => update({ level: Number(event.target.value) })}>
                {[1, 2, 3, 4, 5, 6].map((level_value) => (
                  <option key={level_value} value={level_value}>
                    H{level_value}
                  </option>
                ))}
              </select>
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

          {(is_text || is_number) && (
            <TranslatedTextRow labelKey="DCS_SETTINGS_PLACEHOLDER" value={draft.placeholder} onChange={(value) => update({ placeholder: value })} translate={translate} />
          )}

          {is_input_field && !is_hidden && (
            <>
              <TranslatedTextRow labelKey="DCS_SETTINGS_HELP_TEXT" value={draft.help_text} onChange={(value) => update({ help_text: value })} translate={translate} />
              <TranslatedTextRow labelKey="DCS_SETTINGS_ERROR_MESSAGE" value={draft.error_message} onChange={(value) => update({ error_message: value })} translate={translate} />
              <TranslatedTextRow labelKey="DCS_SETTINGS_VALID_MESSAGE" value={draft.valid_message} onChange={(value) => update({ valid_message: value })} translate={translate} />
            </>
          )}

          {is_media && (
            <div className="space-y-4">
              <div>
                <label className="cok-auth-label">{translate("DCS_SETTINGS_MAX_SIZE")}</label>
                <input type="number" className="cok-auth-input w-full py-3" value={draft.max_size_mb ?? 25} onChange={(event) => update({ max_size_mb: event.target.value })} />
              </div>
              <div>
                <label className="cok-auth-label">{translate("DCS_SETTINGS_ACCEPTED_TYPES")}</label>
                <input
                  className="cok-auth-input w-full py-3"
                  placeholder="image/png, application/pdf"
                  value={(draft.accepted_types || []).join(", ")}
                  onChange={(event) => update({ accepted_types: event.target.value.split(",").map((entry) => entry.trim()).filter(Boolean) })}
                />
              </div>
            </div>
          )}

          {is_date_like && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!draft.exclude_weekends} onChange={(event) => update({ exclude_weekends: event.target.checked })} style={{ accentColor: "#056daa" }} />
              {translate("DCS_SETTINGS_EXCLUDE_WEEKENDS")}
            </label>
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

          {is_cascading && (
            <div>
              <label className="cok-auth-label">{translate("DCS_SETTINGS_CASCADING_PARENT")}</label>
              <select className="cok-auth-input w-full py-2" value={draft.parent_field_id || ""} onChange={(event) => update({ parent_field_id: event.target.value })}>
                <option value="">{translate("DCS_RENDERER_SELECT_PLACEHOLDER")}</option>
                {other_fields.map((candidate_field) => (
                  <option key={candidate_field.id} value={candidate_field.id}>
                    {get_field_text(candidate_field.label, "en") || candidate_field.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(has_options || is_cascading) && (
            <div>
              <label className="cok-auth-label">{translate("DCS_SETTINGS_OPTIONS_TITLE")}</label>
              <div className="space-y-2">
                {(draft.options || []).map((option) => (
                  <div key={option.id} className="border p-3 space-y-2" style={{ borderColor: "#E0E0E0" }}>
                    {LANGUAGES.map((language_code) => (
                      <input
                        key={language_code}
                        className="cok-auth-input w-full py-3"
                        placeholder={language_code.toUpperCase()}
                        value={(option.label && option.label[language_code]) || ""}
                        onChange={(event) => update_option(option.id, { label: Object.assign({}, option.label, { [language_code]: event.target.value }) })}
                      />
                    ))}
                    <input
                      className="cok-auth-input w-full py-3"
                      placeholder="value"
                      value={option.value}
                      onChange={(event) => update_option(option.id, { value: event.target.value })}
                    />
                    {is_cascading && (
                      <input
                        className="cok-auth-input w-full py-3"
                        placeholder="parent value"
                        value={option.parent_value || ""}
                        onChange={(event) => update_option(option.id, { parent_value: event.target.value })}
                      />
                    )}
                    <DcsButtonOutline onClick={() => remove_option(option.id)}>{translate("DCS_SETTINGS_REMOVE")}</DcsButtonOutline>
                  </div>
                ))}
                <DcsButtonOutline onClick={add_option}>{translate("DCS_SETTINGS_ADD_OPTION")}</DcsButtonOutline>
              </div>
            </div>
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
                <div>
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
                </div>
              )}
            </>
          )}

          {is_input_field && (
            <div>
              <label className="cok-auth-label">{translate("DCS_SETTINGS_VALIDATION_TITLE")}</label>
              <ValidationRuleEditor field={draft} allFields={other_fields} onChange={(rules) => update({ validation_rules: rules })} />
            </div>
          )}

          <div>
            <label className="cok-auth-label">{translate("DCS_SETTINGS_VISIBILITY_TITLE")}</label>
            <p className="text-xs mb-3 pt-1" style={{ color: "#9E9E9E" }}>
              {translate("DCS_SETTINGS_VISIBILITY_DESCRIPTION")}
            </p>
            <div className="space-y-3">
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
              <input className="cok-auth-input w-full py-3" value={visibility_ui.value} onChange={(event) => update_visibility({ value: event.target.value })} />
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex gap-3 flex-shrink-0" style={{ borderColor: "#E0E0E0" }}>
          <DcsButtonOutlineReverse className="flex-1" onClick={onClose}>
            {translate("DCS_BTN_CANCEL")}
          </DcsButtonOutlineReverse>
          <DcsButtonPrimary className="flex-1" onClick={() => onSave(draft)}>
            {translate("DCS_BTN_SAVE")}
          </DcsButtonPrimary>
        </div>
      </div>
    </div>
  );
}
