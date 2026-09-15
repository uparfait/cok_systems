import React, { useMemo } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { ChipGrid, Preview, FieldSelect, PRIMARY, BORDER, TEXT_DARK, TEXT_MUTED, HEADING_FONT } from "./builderUi.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import { flatten_field_options } from "../../fields/presetFields.js";
import { get_field_text } from "../../fields/fieldText.js";

/**
 * One "same" condition: a field two records must agree on to count
 * together - on ANY shared value (each shared value then names its own
 * group) or on one fixed value (only those records are counted at all).
 * A choice field offers its options; any other field takes a typed value.
 */
function SameCondition({ entry, index, fields, keyId, taken, onChange, onRemove, disabled }) {
  const { translate } = useDcsLanguage();
  const field = fields.find((candidate) => candidate.id === entry.field_id) || null;
  const options = fields.filter((candidate) => candidate.id !== keyId && (candidate.id === entry.field_id || !taken.includes(candidate.id))).map((candidate) => ({ id: candidate.id, name: candidate.label }));
  const choices = field && field.raw ? flatten_field_options(field.raw) : [];
  const fixed = entry.value !== null && entry.value !== undefined && entry.value !== "";
  return (
    <div className="border p-3 space-y-2" style={{ borderColor: BORDER, backgroundColor: "#FAFBFC" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase" style={{ color: TEXT_MUTED, letterSpacing: "0.4px", ...HEADING_FONT }}>
          {translate("DCS_DB_OCC_SAME_N", { n: index + 1 })}
        </p>
        <button type="button" className="text-xs font-semibold cursor-pointer" style={{ color: "#E74C3C", background: "none", border: "none", padding: 0 }} onClick={onRemove} disabled={disabled}>
          {translate("DCS_SETTINGS_REMOVE")}
        </button>
      </div>
      <FieldSelect options={options} value={entry.field_id} onChange={(field_id) => onChange({ field_id, value: null })} placeholder={translate("DCS_DB_OCC_SAME_FIELD")} disabled={disabled} />
      {field && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-xs sm:w-56" style={{ color: TEXT_MUTED }}>
            {translate("DCS_DB_OCC_SAME_VALUE")}
          </label>
          {choices.length > 0 ? (
            <select className="cok-auth-input py-2 flex-1" value={fixed ? String(entry.value) : ""} disabled={disabled} onChange={(event) => onChange({ field_id: entry.field_id, value: event.target.value || null })}>
              <option value="">{translate("DCS_DB_OCC_SAME_ANY")}</option>
              {choices.map((option) => (
                <option key={option.id || option.value} value={option.value}>
                  {get_field_text(option.label, "en") || String(option.value)}
                </option>
              ))}
            </select>
          ) : (
            <input type="text" className="cok-auth-input py-2 flex-1" value={fixed ? String(entry.value) : ""} placeholder={translate("DCS_DB_OCC_SAME_ANY")} disabled={disabled} onChange={(event) => onChange({ field_id: entry.field_id, value: event.target.value || null })} />
          )}
        </div>
      )}
      <p className="text-xs" style={{ color: TEXT_MUTED }}>
        {field ? translate(fixed ? "DCS_DB_OCC_SAME_FIXED_HINT" : "DCS_DB_OCC_SAME_ANY_HINT", { field: field.label, value: fixed ? String(entry.value) : "" }) : ""}
      </p>
    </div>
  );
}

/** The thresholds a value's count can be held to, in the order shown. */
export const OCCURRENCE_OPERATORS = [
  { id: "", labelKey: "DCS_DB_OCC_RULE_NONE" },
  { id: "gt", labelKey: "DCS_DB_OCC_RULE_GT" },
  { id: "gte", labelKey: "DCS_DB_OCC_RULE_GTE" },
  { id: "eq", labelKey: "DCS_DB_OCC_RULE_EQ" },
  { id: "lte", labelKey: "DCS_DB_OCC_RULE_LTE" },
  { id: "lt", labelKey: "DCS_DB_OCC_RULE_LT" },
];

/**
 * The extra choices of the "Count occurrences" formula, shared by the KPI
 * and chart composers: which fields spell out each counted value (a name
 * and a phone instead of a bare id, joined with " - "), the threshold a
 * value's count must meet (more than, at least, exactly, at most, fewer
 * than a number), and whether only the values meeting it are shown or
 * every value with the meeting ones marked.
 */
export default function OccurrenceOptions({ fields, keyId, spec, onPatch, disabled }) {
  const { translate } = useDcsLanguage();
  const display_ids = Array.isArray(spec.display_ids) ? spec.display_ids : [];
  const candidates = useMemo(() => fields.filter((field) => field.id !== keyId), [fields, keyId]);
  const operator_chips = useMemo(() => OCCURRENCE_OPERATORS.map((operator) => ({ id: operator.id, label: translate(operator.labelKey) })), [translate]);
  const scope_chips = useMemo(
    () => [
      { id: "matching", label: translate("DCS_DB_OCC_SCOPE_MATCHING"), hintKey: "DCS_DB_OCC_SCOPE_MATCHING_HINT" },
      { id: "all", label: translate("DCS_DB_OCC_SCOPE_ALL"), hintKey: "DCS_DB_OCC_SCOPE_ALL_HINT" },
    ],
    [translate],
  );
  const has_rule = !!spec.rule_operator;
  // The text typed between the parts of one label; " - " unless changed.
  const separator = spec.display_separator === undefined || spec.display_separator === null ? " - " : spec.display_separator;

  const same_rules = Array.isArray(spec.same_rules) ? spec.same_rules : [];
  const taken_same = same_rules.map((entry) => entry.field_id);
  const set_same = (index, entry) => onPatch({ same_rules: same_rules.map((current, position) => (position === index ? entry : current)) });
  const remove_same = (index) => onPatch({ same_rules: same_rules.filter((current, position) => position !== index) });
  const add_same = () => onPatch({ same_rules: same_rules.concat([{ field_id: "", value: null }]) });

  const toggle_display = (field_id) => {
    const next = display_ids.includes(field_id) ? display_ids.filter((id) => id !== field_id) : display_ids.concat([field_id]);
    onPatch({ display_ids: next.slice(0, 5) });
  };

  return (
    <div className="dcs-view-swap flex flex-col gap-4 mt-3">
      <div>
        <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>
          {translate("DCS_DB_OCC_DISPLAY")}
        </p>
        <div className="grid gap-1.5 grid-cols-2 sm:grid-cols-3">
          {candidates.map((field) => {
            const active = display_ids.includes(field.id);
            const order = display_ids.indexOf(field.id) + 1;
            return (
              <button
                key={field.id}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => toggle_display(field.id)}
                className="dcs-builder-chip text-xs font-semibold text-left px-3 py-2 truncate cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
                title={field.label}
                style={{ border: `1px solid ${active ? PRIMARY : BORDER}`, backgroundColor: active ? PRIMARY : "#FFFFFF", color: active ? "#FFFFFF" : TEXT_DARK, ...HEADING_FONT }}
              >
                {active && (
                  <span className="flex-shrink-0 inline-flex items-center justify-center text-[10px] font-bold" style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "#FFFFFF", color: PRIMARY }}>
                    {order}
                  </span>
                )}
                <span className="truncate">{field.label}</span>
              </button>
            );
          })}
        </div>
        {display_ids.length > 1 && (
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-xs sm:w-56" style={{ color: TEXT_MUTED }}>
              {translate("DCS_DB_OCC_SEPARATOR")}
            </label>
            <input type="text" className="cok-auth-input py-2 sm:w-40" value={separator} maxLength={10} placeholder=" - " disabled={disabled} onChange={(event) => onPatch({ display_separator: event.target.value })} />
          </div>
        )}
        <Preview>
          {display_ids.length > 0
            ? translate("DCS_DB_OCC_DISPLAY_PREVIEW", { label: display_ids.map((id) => (candidates.find((field) => field.id === id) || {}).label || id).join(separator || " ") })
            : translate("DCS_DB_OCC_DISPLAY_HINT")}
        </Preview>
      </div>

      <div>
        <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>
          {translate("DCS_DB_OCC_SAME")}
        </p>
        <p className="text-xs mb-2" style={{ color: TEXT_MUTED }}>
          {translate("DCS_DB_OCC_SAME_HINT")}
        </p>
        <div className="space-y-2">
          {same_rules.map((entry, index) => (
            <SameCondition key={index} entry={entry} index={index} fields={fields} keyId={keyId} taken={taken_same} onChange={(next) => set_same(index, next)} onRemove={() => remove_same(index)} disabled={disabled} />
          ))}
        </div>
        {same_rules.length < 5 && (
          <div className="mt-2 w-full sm:w-64">
            <DcsButtonOutline onClick={add_same} disabled={disabled}>
              {translate("DCS_DB_OCC_SAME_ADD")}
            </DcsButtonOutline>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>
          {translate("DCS_DB_OCC_RULE")}
        </p>
        {/* The number sits on its own row under the operators, so it never
            squeezes or hides them. */}
        <ChipGrid options={operator_chips} value={spec.rule_operator || ""} onChange={(rule_operator) => onPatch({ rule_operator })} disabled={disabled} columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" />
        {has_rule && (
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-xs sm:w-56" style={{ color: TEXT_MUTED }}>
              {translate("DCS_DB_OCC_RULE_VALUE")}
            </label>
            <input
              type="number"
              min="0"
              step="1"
              className="cok-auth-input py-2 sm:w-40"
              value={spec.rule_value === undefined || spec.rule_value === null ? "" : spec.rule_value}
              placeholder="0"
              disabled={disabled}
              onChange={(event) => onPatch({ rule_value: event.target.value })}
            />
          </div>
        )}
        <Preview>{has_rule ? translate("DCS_DB_OCC_RULE_HINT") : translate("DCS_DB_OCC_RULE_NONE_HINT")}</Preview>
      </div>

      {has_rule && (
        <div>
          <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>
            {translate("DCS_DB_OCC_SCOPE")}
          </p>
          <ChipGrid options={scope_chips} value={spec.rule_scope || "matching"} onChange={(rule_scope) => onPatch({ rule_scope })} disabled={disabled} columns="grid-cols-1 sm:grid-cols-2" />
        </div>
      )}
    </div>
  );
}
