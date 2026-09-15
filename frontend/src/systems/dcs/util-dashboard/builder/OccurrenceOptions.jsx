import React, { useMemo } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { ChipGrid, Preview, PRIMARY, BORDER, TEXT_DARK, TEXT_MUTED, HEADING_FONT } from "./builderUi.jsx";

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
        <Preview>
          {display_ids.length > 0
            ? translate("DCS_DB_OCC_DISPLAY_PREVIEW", { label: display_ids.map((id) => (candidates.find((field) => field.id === id) || {}).label || id).join(" - ") })
            : translate("DCS_DB_OCC_DISPLAY_HINT")}
        </Preview>
      </div>

      <div>
        <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>
          {translate("DCS_DB_OCC_RULE")}
        </p>
        <div className="flex flex-col sm:flex-row sm:items-start gap-2">
          <div className="flex-1 min-w-0">
            <ChipGrid options={operator_chips} value={spec.rule_operator || ""} onChange={(rule_operator) => onPatch({ rule_operator })} disabled={disabled} columns="grid-cols-3 sm:grid-cols-6" />
          </div>
          {has_rule && (
            <input
              type="number"
              min="0"
              step="1"
              className="cok-auth-input py-2 sm:w-32"
              value={spec.rule_value === undefined || spec.rule_value === null ? "" : spec.rule_value}
              placeholder={translate("DCS_DB_OCC_RULE_VALUE")}
              disabled={disabled}
              onChange={(event) => onPatch({ rule_value: event.target.value })}
            />
          )}
        </div>
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
