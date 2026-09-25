import React, { useMemo, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { field_type_key } from "./composeWidgets.js";
import { PRIMARY, BORDER, TEXT_DARK, TEXT_MUTED, HEADING_FONT } from "./builderUi.jsx";
import { MAX_FIELDS } from "./tableCompose.js";

/**
 * The fields a RECORDS table shows, ticked one by one - in the order they
 * are ticked, which is the order of the columns. A search box narrows the
 * list; the count at the foot says how many are chosen and how many may be.
 */
export default function TableFieldsPicker({ fields, value, onChange, disabled }) {
  const { translate } = useDcsLanguage();
  const [query, setQuery] = useState("");
  const chosen = value || [];
  const order = new Map(chosen.map((id, index) => [id, index + 1]));
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (fields || []).filter((field) => !needle || field.label.toLowerCase().includes(needle));
  }, [fields, query]);
  const toggle = (field_id) => {
    if (order.has(field_id)) return onChange(chosen.filter((id) => id !== field_id));
    if (chosen.length >= MAX_FIELDS) return undefined;
    return onChange(chosen.concat([field_id]));
  };
  return (
    <div className="flex flex-col gap-2">
      <input className="cok-auth-input w-full py-2" placeholder={translate("DCS_DB_TABLE_FIELDS_SEARCH")} value={query} disabled={disabled} onChange={(event) => setQuery(event.target.value)} />
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2" style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 320, overflowY: "auto" }}>
        {shown.map((field) => {
          const on = order.has(field.id);
          const type_key = field_type_key(field);
          const blocked = !on && chosen.length >= MAX_FIELDS;
          return (
            <li key={field.id}>
              <button
                type="button"
                disabled={disabled || blocked}
                aria-pressed={on}
                className="dcs-filter-tab-row w-full text-left flex items-center gap-3 p-2 border-2"
                style={{ borderColor: on ? PRIMARY : BORDER, backgroundColor: on ? "rgba(5,109,170,0.05)" : "#FFFFFF", cursor: disabled || blocked ? "not-allowed" : "pointer", opacity: blocked ? 0.55 : 1 }}
                onClick={() => toggle(field.id)}
              >
                <span className="flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ width: 20, height: 20, border: `2px solid ${on ? PRIMARY : BORDER}`, backgroundColor: on ? PRIMARY : "#FFFFFF", color: "#FFFFFF", ...HEADING_FONT }}>
                  {on ? order.get(field.id) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold break-words" style={{ color: TEXT_DARK, ...HEADING_FONT }}>{field.label}</span>
                  <span className="block text-[11px]" style={{ color: TEXT_MUTED }}>{type_key ? translate(type_key) : field.type}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_TABLE_FIELDS_COUNT", { count: chosen.length, max: MAX_FIELDS })}</p>
    </div>
  );
}
