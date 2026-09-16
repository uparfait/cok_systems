import React, { useRef, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import MenuPopover from "../MenuPopover.jsx";
import { field_type_key } from "../builder/composeWidgets.js";
import { MAX_BOARD_FILTERS } from "../boardFilters.js";

const PLUS = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const TICK = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

/**
 * The "add a filter" control of the filter bar: a button that opens the
 * list of the form's fields that CAN filter the board (selects, radios,
 * cascading selects and select groups only). Each row shows the field's
 * type and, when the board's widgets read that field, how many of them a
 * filter on it will reshape. Rows already on the board are ticked; a click
 * toggles them.
 */
export default function FilterPicker({ candidates, usage, defs, onToggle, disabled }) {
  const { translate } = useDcsLanguage();
  const anchor_ref = useRef(null);
  const [open, setOpen] = useState(false);
  const chosen = new Set((defs || []).map((def) => def.field_id));
  const full = chosen.size >= MAX_BOARD_FILTERS;

  return (
    <>
      <button ref={anchor_ref} type="button" className={`dcs-board-filter dcs-board-filter-add ${open ? "is-open" : ""}`} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} title={translate("DCS_DB_FILTER_ADD")} onClick={() => setOpen((current) => !current)}>
        {PLUS}
        <span className="dcs-board-filter-value">{translate("DCS_DB_FILTER_ADD")}</span>
      </button>
      <MenuPopover open={open} anchorRef={anchor_ref} onClose={() => setOpen(false)} minWidth={300} maxHeight={440} align="start" role="listbox">
        <div className="dcs-board-switcher-head">
          <span>{translate("DCS_DB_FILTER_PICK_TITLE")}</span>
          <span>
            {chosen.size}/{MAX_BOARD_FILTERS}
          </span>
        </div>
        <ul className="dcs-board-switcher-list">
          {candidates.map((field) => {
            const selected = chosen.has(field.id);
            const used = (usage && usage.get(field.id)) || 0;
            const type_key = field_type_key(field);
            return (
              <li key={field.id}>
                <button type="button" role="option" aria-selected={selected} disabled={!selected && full} className={`dcs-board-switcher-item ${selected ? "is-active" : ""}`} style={!selected && full ? { opacity: 0.5, cursor: "not-allowed" } : undefined} onClick={() => onToggle(field.id)}>
                  <span className={`dcs-board-filter-tick ${selected ? "is-on" : ""}`}>{selected ? TICK : null}</span>
                  <span className="min-w-0 flex-1">
                    <span className="dcs-board-switcher-item-name">{field.label}</span>
                    <span className="dcs-board-switcher-item-meta">
                      {type_key ? translate(type_key) : field.type}
                      {used > 0 ? ` - ${translate("DCS_DB_FILTER_USED_BY", { count: used })}` : ""}
                    </span>
                  </span>
                  {used > 0 && <span className="dcs-board-filter-usage">{used}</span>}
                </button>
              </li>
            );
          })}
          {candidates.length === 0 && <li className="dcs-board-switcher-empty">{translate("DCS_DB_FILTER_NO_CANDIDATES")}</li>}
        </ul>
        <div className="dcs-board-switcher-empty" style={{ borderTop: "1px solid var(--board-border, #E0E0E0)" }}>
          {translate("DCS_DB_FILTER_PICK_HINT")}
        </div>
      </MenuPopover>
    </>
  );
}
