import React, { useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";

const TEXT_MUTED = "#9E9E9E";
const SEARCH_FROM = 8;

/**
 * Which fields of a record a share link's viewers may see, once the link
 * lets them open the records behind a widget. Every field the table can
 * ever show is listed - the form's current fields first, then the ones
 * only older versions asked (marked, since only older records answer
 * them) - and unchecking one keeps it off the table AND out of the
 * server's answer, so it is never sent at all.
 *
 * Nothing picked means every field, which is also what a link saved before
 * this existed means; fields added to the form later then show up on their
 * own. At least one field always stays visible - a table with no columns
 * would say nothing.
 */
export default function RecordFieldsPicker({ options, value, onChange }) {
  const { translate } = useDcsLanguage();
  const [query, setQuery] = useState("");
  const all_ids = (options || []).map((option) => option.id);
  const picked = (value || []).filter((id) => all_ids.includes(id));
  const selected = new Set(picked.length > 0 ? picked : all_ids);
  const everything = selected.size === all_ids.length;

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) {
      if (next.size <= 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    // All of them is saved as "nothing picked", so later fields join in too.
    onChange(next.size === all_ids.length ? [] : all_ids.filter((entry) => next.has(entry)));
  };

  if (all_ids.length === 0) {
    return (
      <p className="text-xs" style={{ color: TEXT_MUTED }}>
        {translate("DCS_DB_SHARE_FIELDS_NONE")}
      </p>
    );
  }

  const shown = query.trim() ? options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase())) : options;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="cok-auth-label">{translate("DCS_DB_SHARE_RECORD_FIELDS")}</p>
        <div className="flex items-baseline gap-2 flex-shrink-0">
          <span className="dcs-record-fields-count">{translate("DCS_DB_SHARE_FIELDS_COUNT", { count: selected.size, total: all_ids.length })}</span>
          <button type="button" className="dcs-link-action dcs-record-fields-all" disabled={everything} onClick={() => onChange([])}>
            {translate("DCS_DB_SHARE_FIELDS_ALL")}
          </button>
        </div>
      </div>
      {all_ids.length >= SEARCH_FROM && <input className="cok-auth-input w-full py-1 mt-1" value={query} placeholder={translate("DCS_DB_FILTER_SEARCH")} onChange={(event) => setQuery(event.target.value)} />}
      <div className="dcs-record-fields-box mt-1">
        {shown.map((option) => {
          const on = selected.has(option.id);
          const last = on && selected.size <= 1;
          return (
            <label key={option.id} className={`dcs-record-fields-row ${last ? "is-last" : ""}`} title={last ? translate("DCS_DB_SHARE_FIELDS_LAST") : option.label}>
              <input type="checkbox" checked={on} disabled={last} style={{ accentColor: "#056daa" }} onChange={() => toggle(option.id)} />
              <span className="dcs-record-fields-name">{option.label}</span>
              {option.retired && <span className="dcs-record-fields-tag">{translate("DCS_DB_SHARE_FIELDS_RETIRED")}</span>}
            </label>
          );
        })}
        {shown.length === 0 && <p className="dcs-record-fields-empty">{translate("DCS_DB_FILTER_NO_VALUES")}</p>}
      </div>
      <p className="text-xs mt-1" style={{ color: TEXT_MUTED }}>
        {translate("DCS_DB_SHARE_RECORD_FIELDS_HINT")}
      </p>
    </div>
  );
}
