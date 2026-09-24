import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";

const PRIMARY = "#056daa";

/**
 * The three controls every row carries in the pinned Actions column: tick
 * it, look at it, change it. Deleting is not among them on purpose - it
 * belongs to the selection, above the table, where one confirmation can
 * cover everything that is ticked instead of one per row.
 */

export function SelectBox({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className="dcs-dt-rowbtn cursor-pointer"
    >
      <span className={`dcs-dt-check-box ${checked ? "is-on" : ""}`} style={{ marginTop: 0 }}>
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="4 12.5 9.5 18 20 6.5" />
          </svg>
        )}
      </span>
    </button>
  );
}

function IconButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="dcs-dt-rowbtn cursor-pointer"
    >
      {children}
    </button>
  );
}

export default function DcsRowActionsCell({ selected, onSelectChange, onView, onEdit }) {
  const { translate } = useDcsLanguage();

  return (
    <span className="flex items-center gap-0.5">
      <SelectBox checked={selected} onChange={onSelectChange} label={translate("DCS_TABLE_SELECT_ROW")} />

      <IconButton label={translate("DCS_TABLE_VIEW_RECORD")} onClick={onView}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1.8 12S5.5 5 12 5s10.2 7 10.2 7-3.7 7-10.2 7S1.8 12 1.8 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </IconButton>

      <IconButton label={translate("DCS_TABLE_EDIT_RECORD")} onClick={onEdit}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 013 3L7.5 18.5 3.5 19.5l1-4z" />
        </svg>
      </IconButton>
    </span>
  );
}
