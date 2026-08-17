import React from "react";
import { get_field_text } from "./fieldText.js";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

/**
 * Order items by preference using simple, touch-friendly move-up and
 * move-down controls (reliable on mobile, unlike drag gestures).
 */
export default function RankingField({ field, language, mode, value, onChange, error, ruleValidMessage }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const label = get_field_text(field.label, language);
  const help_text = get_field_text(field.help_text, language);
  const valid_message = ruleValidMessage || (field.mandatory && get_field_text(field.valid_message, language));
  const options = field.options || [];
  const ordered_values = Array.isArray(value) && value.length > 0 ? value : options.map((option) => option.value);

  const move_item = (index, direction) => {
    if (!onChange) return;
    const next_order = ordered_values.slice();
    const target_index = index + direction;
    if (target_index < 0 || target_index >= next_order.length) return;
    const temp = next_order[index];
    next_order[index] = next_order[target_index];
    next_order[target_index] = temp;
    onChange(next_order);
  };

  return (
    <div className="w-full">
      <label className="cok-auth-label" title={help_text || undefined}>
        {label}
        {field.mandatory && <span style={{ color: "#E74C3C" }}> *</span>}
      </label>
      <p className="text-xs mb-2" style={{ color: "#9E9E9E" }}>
        {translate("DCS_RENDERER_RANKING_INSTRUCTION")}
      </p>
      <div className="space-y-2">
        {ordered_values.map((option_value, index) => {
          const option = options.find((entry) => entry.value === option_value);
          return (
            <div key={option_value} className="flex items-center justify-between gap-2 px-3 py-2 border" style={{ borderColor: "#E0E0E0" }}>
              <span style={{ color: "#333333", fontSize: 14 }}>
                {index + 1}. {option ? get_field_text(option.label, language) : option_value}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={is_builder || index === 0}
                  onClick={() => move_item(index, -1)}
                  className="cok-btn-outlined"
                  style={{ padding: "0.2rem 0.5rem" }}
                >
                  {translate("DCS_BTN_PREVIOUS")}
                </button>
                <button
                  type="button"
                  disabled={is_builder || index === ordered_values.length - 1}
                  onClick={() => move_item(index, 1)}
                  className="cok-btn-outlined"
                  style={{ padding: "0.2rem 0.5rem" }}
                >
                  {translate("DCS_BTN_NEXT")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {error && (
        <p className="mt-1 text-xs" style={{ color: "#E74C3C", fontFamily: "'Montserrat', sans-serif", whiteSpace: "pre-line" }}>
          {error}
        </p>
      )}
      {!error && Array.isArray(value) && value.length > 0 && valid_message && (
        <p className="mt-1 text-xs" style={{ color: "#4CAF50", fontFamily: "'Montserrat', sans-serif" }}>
          {valid_message}
        </p>
      )}
    </div>
  );
}
