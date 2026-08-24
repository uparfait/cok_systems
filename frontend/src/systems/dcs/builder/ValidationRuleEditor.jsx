import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_applicable_operators, build_validation_condition } from "./validationOperators.js";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import { get_field_text } from "../fields/fieldText.js";
import { DCS_SELECT_LIKE_TYPES } from "../fields/fieldTypes.js";

const LANGUAGES = ["en", "kn", "fr"];

/**
 * Authors the list of validation rules for one field: pick an operator,
 * its value, the message to show in every language, and whether it is a
 * hard error or a soft warning. Builds the underlying JSONLogic condition
 * automatically from the chosen operator.
 */
export default function ValidationRuleEditor({ field, allFields, onChange, ruleErrors }) {
  const { translate } = useDcsLanguage();
  const rules = field.validation_rules || [];
  const applicable_operators = get_applicable_operators(field.type);
  const get_operator_meta = (operator_id) => applicable_operators.find((operator) => operator.id === operator_id) || {};

  const update_rule = (rule_id, patch) => {
    const next_rules = rules.map((rule) => {
      if (rule.id !== rule_id) return rule;
      const next_rule = Object.assign({}, rule, patch);
      next_rule.condition = build_validation_condition(
        field.id,
        next_rule.operator,
        next_rule.value,
        next_rule.parent_field_id,
        next_rule.parent_value,
      );
      return next_rule;
    });
    onChange(next_rules);
  };

  const add_rule = () => {
    const new_rule = {
      id: `rule_${Math.random().toString(36).slice(2, 8)}`,
      operator: applicable_operators[0].id,
      value: "",
      parent_field_id: null,
      parent_value: "",
      message: { en: "", kn: "", fr: "" },
      valid_message: { en: "", kn: "", fr: "" },
      severity: "error",
      condition: null,
    };
    onChange(rules.concat([new_rule]));
  };

  const remove_rule = (rule_id) => {
    onChange(rules.filter((rule) => rule.id !== rule_id));
  };

  const other_fields = (allFields || []).filter((candidate_field) => candidate_field.id !== field.id);

  return (
    <div className="space-y-4">
      {rules.map((rule, rule_index) => {
        const operator_meta = get_operator_meta(rule.operator);
        const rule_messages = (ruleErrors && ruleErrors[rule_index]) || [];
        const rule_has_error = rule_messages.length > 0;
        return (
        <div
          key={rule.id}
          className="border p-4 space-y-3"
          style={{ borderColor: rule_has_error ? "#E74C3C" : "#E0E0E0", backgroundColor: rule_has_error ? "rgba(231,76,60,0.05)" : undefined }}
        >
          {rule_has_error && (
            <div className="space-y-1">
              {rule_messages.map((message, message_index) => (
                <p key={message_index} className="text-xs" style={{ color: "#E74C3C" }}>{message}</p>
              ))}
            </div>
          )}
          <div>
            <label className="cok-auth-label">{translate("DCS_SETTINGS_VALIDATION_OPERATOR")}</label>
            <select
              className="cok-auth-input w-full py-3"
              value={rule.operator}
              onChange={(event) => update_rule(rule.id, { operator: event.target.value })}
            >
              {applicable_operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {translate(operator.labelKey)}
                </option>
              ))}
            </select>
          </div>
          {operator_meta.needsValue && (
            <div>
              <label className="cok-auth-label">{translate("DCS_SETTINGS_VALIDATION_VALUE")}</label>
              {DCS_SELECT_LIKE_TYPES.includes(field.type) ? (
                <select
                  className="cok-auth-input w-full py-3"
                  value={rule.value}
                  onChange={(event) => update_rule(rule.id, { value: event.target.value })}
                >
                  <option value="">{translate("DCS_RENDERER_SELECT_PLACEHOLDER")}</option>
                  {(field.options || []).map((option) => (
                    <option key={option.id} value={option.value}>
                      {get_field_text(option.label, "en") || option.value}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="cok-auth-input w-full py-3"
                  value={rule.value}
                  onChange={(event) => update_rule(rule.id, { value: event.target.value })}
                />
              )}
            </div>
          )}

          {operator_meta.needsParent && (
            <>
              <div>
                <label className="cok-auth-label">{translate("DCS_SETTINGS_PARENT_FIELD")}</label>
                <select
                  className="cok-auth-input w-full py-3"
                  value={rule.parent_field_id || ""}
                  onChange={(event) => update_rule(rule.id, { parent_field_id: event.target.value })}
                >
                  <option value="" disabled>
                    {translate("DCS_RENDERER_SELECT_PLACEHOLDER")}
                  </option>
                  {other_fields.map((candidate_field) => (
                    <option key={candidate_field.id} value={candidate_field.id}>
                      {get_field_text(candidate_field.label, "en") || candidate_field.id}
                    </option>
                  ))}
                </select>
              </div>
              {operator_meta.needsParentValue && (() => {
                const parent_field = other_fields.find((candidate_field) => candidate_field.id === rule.parent_field_id);
                if (parent_field && DCS_SELECT_LIKE_TYPES.includes(parent_field.type)) {
                  return (
                    <div>
                      <label className="cok-auth-label">{translate("DCS_SETTINGS_VALIDATION_VALUE")}</label>
                      <select
                        className="cok-auth-input w-full py-3"
                        value={rule.parent_value}
                        onChange={(event) => update_rule(rule.id, { parent_value: event.target.value })}
                      >
                        <option value="">{translate("DCS_RENDERER_SELECT_PLACEHOLDER")}</option>
                        {(parent_field.options || []).map((option) => (
                          <option key={option.id} value={option.value}>
                            {get_field_text(option.label, "en") || option.value}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return (
                  <div>
                    <label className="cok-auth-label">{translate("DCS_SETTINGS_VALIDATION_VALUE")}</label>
                    <input
                      className="cok-auth-input w-full py-3"
                      value={rule.parent_value}
                      onChange={(event) => update_rule(rule.id, { parent_value: event.target.value })}
                    />
                  </div>
                );
              })()}
            </>
          )}

          <div>
            <label className="cok-auth-label">
              {operator_meta.invalidMessageLabelKey
                ? translate(operator_meta.invalidMessageLabelKey)
                : translate("DCS_SETTINGS_VALIDATION_MESSAGE_FOR", { criterion: translate(operator_meta.labelKey) })}
            </label>
            <div className="space-y-2">
              {LANGUAGES.map((language_code) => (
                <input
                  key={language_code}
                  className="cok-auth-input w-full py-3"
                  placeholder={language_code.toUpperCase()}
                  value={rule.message[language_code] || ""}
                  onChange={(event) =>
                    update_rule(rule.id, { message: Object.assign({}, rule.message, { [language_code]: event.target.value }) })
                  }
                />
              ))}
            </div>
          </div>

          <div>
            <label className="cok-auth-label">
              {operator_meta.validMessageLabelKey
                ? translate(operator_meta.validMessageLabelKey)
                : translate("DCS_SETTINGS_VALIDATION_VALID_MESSAGE_FOR", { criterion: translate(operator_meta.labelKey) })}
            </label>
            <div className="space-y-2">
              {LANGUAGES.map((language_code) => (
                <input
                  key={language_code}
                  className="cok-auth-input w-full py-3"
                  placeholder={language_code.toUpperCase()}
                  value={(rule.valid_message && rule.valid_message[language_code]) || ""}
                  onChange={(event) =>
                    update_rule(rule.id, {
                      valid_message: Object.assign({}, rule.valid_message, { [language_code]: event.target.value }),
                    })
                  }
                />
              ))}
            </div>
          </div>

          <div>
            <label className="cok-auth-label">{translate("DCS_SETTINGS_VALIDATION_SEVERITY")}</label>
            <select
              className="cok-auth-input w-full py-3"
              value={rule.severity}
              onChange={(event) => update_rule(rule.id, { severity: event.target.value })}
            >
              <option value="error">{translate("DCS_SETTINGS_SEVERITY_ERROR")}</option>
              <option value="warning">{translate("DCS_SETTINGS_SEVERITY_WARNING")}</option>
            </select>
          </div>
          <DcsButtonOutline className="w-full" onClick={() => remove_rule(rule.id)}>{translate("DCS_SETTINGS_REMOVE")}</DcsButtonOutline>
        </div>
        );
      })}

      <DcsButtonOutline className="w-full" onClick={add_rule}>{translate("DCS_SETTINGS_VALIDATION_ADD_RULE")}</DcsButtonOutline>
    </div>
  );
}
