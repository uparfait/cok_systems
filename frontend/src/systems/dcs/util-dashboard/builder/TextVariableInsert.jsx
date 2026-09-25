import React, { useMemo, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { ChipGrid, FieldSelect, Problem, TEXT_MUTED, PRIMARY, HEADING_FONT } from "./builderUi.jsx";
import { field_options } from "./composeWidgets.js";
import { TEXT_FORMULAS, FORMULA_LABEL_KEYS, variable_token } from "../textVariables.js";

/**
 * The composer's way of writing a LIVE FIGURE into a text block without
 * knowing the grammar: pick the formula, the field it reads (a count may
 * read none, meaning every record in scope; a share must name the value
 * whose share is wanted), an optional value to count, and an optional
 * condition on another field - then Insert writes the token where the
 * cursor is. The token is shown before it is inserted, so the grammar is
 * learnt in passing.
 */
export default function TextVariableInsert({ fields, onInsert, disabled }) {
  const { translate } = useDcsLanguage();
  const [formula, setFormula] = useState("count");
  const [field_id, setFieldId] = useState("");
  const [value, setValue] = useState("");
  const [where_field, setWhereField] = useState("");
  const [where_value, setWhereValue] = useState("");
  const options = useMemo(() => field_options(fields, translate), [fields, translate]);
  const chips = TEXT_FORMULAS.map((id) => ({ id, label: translate(FORMULA_LABEL_KEYS[id]) }));
  const counts = formula === "count" || formula === "share";
  const problem = formula !== "count" && !field_id ? translate("DCS_DB_TEXT_VAR_NEED_FIELD") : formula === "share" && !String(value).trim() ? translate("DCS_DB_TEXT_VAR_NEED_VALUE") : where_field && !String(where_value).trim() ? translate("DCS_DB_TEXT_VAR_NEED_WHERE_VALUE") : "";
  const token = problem ? "" : variable_token(formula, field_id, counts ? value : "", where_field, where_value);
  const input = { ...HEADING_FONT };
  return (
    <div className="border-2 p-3 flex flex-col gap-2" style={{ borderColor: "#E0E0E0" }}>
      <p className="text-xs font-bold uppercase" style={{ color: PRIMARY, letterSpacing: "0.4px", ...HEADING_FONT }}>
        {translate("DCS_DB_TEXT_VARS_TITLE")}
      </p>
      <p className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_TEXT_VARS_HINT")}</p>
      <p className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_TEXT_VAR_FORMULA")}</p>
      <ChipGrid options={chips} value={formula} onChange={(next) => { setFormula(next); if (next !== "count" && next !== "share") setValue(""); }} disabled={disabled} columns="grid-cols-2 sm:grid-cols-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <FieldSelect label={translate("DCS_DB_TEXT_VAR_FIELD")} options={options} value={field_id} onChange={setFieldId} placeholder={translate(formula === "count" ? "DCS_DB_GEN_TOTAL" : "DCS_DB_NEED_MEASURE_FIELD")} disabled={disabled} allowClear={formula === "count"} />
        {counts && (
          <label className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: TEXT_MUTED }}>{translate(formula === "share" ? "DCS_DB_TEXT_VAR_SHARE_VALUE" : "DCS_DB_TEXT_VAR_VALUE")}</span>
            <input className="dcs-rename-input" style={input} value={value} disabled={disabled || !field_id} placeholder={translate("DCS_DB_TABLE_COLUMN_FILTER_VALUE")} onChange={(event) => setValue(event.target.value)} />
          </label>
        )}
      </div>
      <p className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_TEXT_VAR_WHERE")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <FieldSelect options={options} value={where_field} onChange={setWhereField} placeholder={translate("DCS_DB_TABLE_COLUMN_FILTER_FIELD")} disabled={disabled} allowClear />
        <input className="dcs-rename-input" style={input} value={where_value} disabled={disabled || !where_field} placeholder={translate("DCS_DB_TABLE_COLUMN_FILTER_VALUE")} onChange={(event) => setWhereValue(event.target.value)} />
      </div>
      <Problem>{problem}</Problem>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="text-xs font-bold uppercase px-3 py-2 cursor-pointer disabled:cursor-not-allowed" style={{ color: "#FFFFFF", backgroundColor: PRIMARY, border: `1px solid ${PRIMARY}`, letterSpacing: "0.4px", ...HEADING_FONT }} disabled={disabled || !token} onClick={() => onInsert(token)}>
          {translate("DCS_DB_TEXT_VAR_INSERT")}
        </button>
        {token && (
          <code className="text-xs px-2 py-1" style={{ backgroundColor: "#F7F9FB", color: "#333333" }}>
            {token}
          </code>
        )}
      </div>
    </div>
  );
}
