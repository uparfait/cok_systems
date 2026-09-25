import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { ChipGrid, FieldSelect, PRIMARY, BORDER, TEXT_DARK, TEXT_MUTED, HEADING_FONT } from "./builderUi.jsx";
import { field_options, formula_of } from "./composeWidgets.js";
import { COLUMN_FORMULAS, FIELD_FORMULAS, COLUMN_OPERATORS, new_column } from "./tableCompose.js";

const DANGER = "#E74C3C";
const VALUELESS = ["empty", "not_empty"];
const OPERATOR_KEYS = {
  eq: "DCS_DB_OP_EQ",
  ne: "DCS_DB_OP_NE",
  contains: "DCS_DB_OP_CONTAINS",
  gt: "DCS_DB_OP_GT",
  gte: "DCS_DB_OP_GTE",
  lt: "DCS_DB_OP_LT",
  lte: "DCS_DB_OP_LTE",
  empty: "DCS_DB_OP_EMPTY",
  not_empty: "DCS_DB_OP_NOT_EMPTY",
};

/**
 * The MEASURE columns of a summary table, one card each: a label, the
 * formula, the field it reads (when the formula needs one), and an
 * optional filter of its own - "Annex: count of records whose other
 * structures include annex" is a count column filtered on that value.
 * Columns are added at the bottom and removed one by one.
 */
export default function TableColumnsEditor({ fields, columns, onChange, disabled }) {
  const { translate } = useDcsLanguage();
  const all_options = field_options(fields, translate);
  const formula_chips = COLUMN_FORMULAS.map((id) => {
    const formula = formula_of(id);
    return { id, label: formula ? translate(formula.labelKey) : id };
  });
  const update = (index, changes) => onChange(columns.map((column, at) => (at === index ? { ...column, ...changes } : column)));
  const remove = (index) => onChange(columns.filter((_, at) => at !== index));
  const add = () => onChange(columns.concat([new_column()]));
  const field_label = (id) => (fields.find((field) => field.id === id) || {}).label || "";

  return (
    <div className="flex flex-col gap-3">
      {columns.length === 0 && (
        <p className="text-xs px-3 py-2" style={{ color: TEXT_MUTED, backgroundColor: "#F7F9FB" }}>{translate("DCS_DB_TABLE_NO_COLUMNS")}</p>
      )}
      {columns.map((column, index) => {
        const needs_field = FIELD_FORMULAS.includes(column.aggregation);
        const valueless = VALUELESS.includes(column.filter_operator);
        return (
          <div key={column.key} className="border-2 p-3 flex flex-col gap-2" style={{ borderColor: BORDER }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase" style={{ color: PRIMARY, letterSpacing: "0.4px", ...HEADING_FONT }}>
                {translate("DCS_DB_TABLE_COLUMN_N", { n: index + 1 })}
              </span>
              <button type="button" className="text-xs font-semibold cursor-pointer" style={{ color: DANGER, background: "none", border: "none", padding: 0, ...HEADING_FONT }} disabled={disabled} onClick={() => remove(index)}>
                {translate("DCS_DB_TABLE_REMOVE_COLUMN")}
              </button>
            </div>
            <input className="cok-auth-input w-full py-2" placeholder={translate("DCS_DB_TABLE_COLUMN_LABEL")} value={column.label} maxLength={120} disabled={disabled} onChange={(event) => update(index, { label: event.target.value })} />
            <p className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_TABLE_COLUMN_FORMULA")}</p>
            <ChipGrid options={formula_chips} value={column.aggregation} onChange={(aggregation) => update(index, { aggregation })} disabled={disabled} columns="grid-cols-2 sm:grid-cols-4" />
            {(needs_field || column.aggregation === "count") && (
              <FieldSelect
                label={translate(needs_field ? "DCS_DB_TABLE_COLUMN_FIELD" : "DCS_DB_TABLE_COLUMN_COUNT_FIELD")}
                options={all_options}
                value={column.field_id}
                onChange={(field_id) => update(index, { field_id, label: column.label || field_label(field_id) })}
                placeholder={translate(needs_field ? "DCS_DB_NEED_MEASURE_FIELD" : "DCS_DB_GEN_TOTAL")}
                disabled={disabled}
                allowClear={!needs_field}
              />
            )}
            <p className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_TABLE_COLUMN_FILTER")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <FieldSelect options={all_options} value={column.filter_field} onChange={(filter_field) => update(index, { filter_field })} placeholder={translate("DCS_DB_TABLE_COLUMN_FILTER_FIELD")} disabled={disabled} allowClear />
              <select className="dcs-over-time-select" value={column.filter_operator} disabled={disabled || !column.filter_field} onChange={(event) => update(index, { filter_operator: event.target.value })} aria-label={translate("DCS_DB_TABLE_COLUMN_FILTER")}>
                {COLUMN_OPERATORS.map((operator) => (
                  <option key={operator} value={operator}>
                    {translate(OPERATOR_KEYS[operator])}
                  </option>
                ))}
              </select>
              <input className="dcs-rename-input" style={{ ...HEADING_FONT, color: TEXT_DARK }} placeholder={translate("DCS_DB_TABLE_COLUMN_FILTER_VALUE")} value={valueless ? "" : column.filter_value} disabled={disabled || !column.filter_field || valueless} onChange={(event) => update(index, { filter_value: event.target.value })} />
            </div>
          </div>
        );
      })}
      <button type="button" className="text-xs font-bold uppercase px-3 py-2 cursor-pointer self-start" style={{ color: PRIMARY, border: `1px solid ${PRIMARY}`, background: "none", letterSpacing: "0.4px", ...HEADING_FONT }} disabled={disabled || columns.length >= 30} onClick={add}>
        {translate("DCS_DB_TABLE_ADD_COLUMN")}
      </button>
    </div>
  );
}
