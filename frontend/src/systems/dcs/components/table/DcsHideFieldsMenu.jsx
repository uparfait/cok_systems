import React, { useRef, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import MenuPopover from "../../util-dashboard/MenuPopover.jsx";

const PRIMARY = "#056daa";
const FONT = "'Montserrat', sans-serif";

/**
 * "Hide fields": one tick per column the table could show - the form's
 * own questions and the columns the system adds (approval, version, who
 * submitted, when). A ticked column is hidden, and it is hidden for
 * EVERYONE who opens this table until it is unticked again, which is why
 * the set is saved on the server rather than in this browser.
 *
 * Someone who may only read the form still sees the list and what is
 * currently hidden, but cannot change it - hiding a column changes what
 * every other reader sees.
 */
function CheckRow({ label, hidden, disabled, onToggle }) {
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={hidden} disabled={disabled} onClick={onToggle} className={`dcs-dt-check ${disabled ? "" : "cursor-pointer"}`} style={{ opacity: disabled ? 0.6 : 1 }}>
      <span className={`dcs-dt-check-box ${hidden ? "is-on" : ""}`}>
        {hidden && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="4 12.5 9.5 18 20 6.5" />
          </svg>
        )}
      </span>
      <span className="min-w-0 break-words">{label}</span>
    </button>
  );
}

export default function DcsHideFieldsMenu({ columns, hidden, canEdit, saving, onChange }) {
  const { translate } = useDcsLanguage();
  const [open, setOpen] = useState(false);
  const trigger_ref = useRef(null);

  const hidden_set = new Set(hidden || []);
  const hideable = (columns || []).filter((column) => column.key !== "actions");

  const toggle = (key) => {
    if (!canEdit) return;
    const next = new Set(hidden_set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(Array.from(next));
  };

  const set_all = (hide_them) => {
    if (!canEdit) return;
    onChange(hide_them ? hideable.map((column) => column.key) : []);
  };

  const hidden_count = hideable.filter((column) => hidden_set.has(column.key)).length;

  return (
    <>
      <button
        ref={trigger_ref}
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={translate("DCS_TABLE_HIDE_FIELDS")}
        className={`dcs-dt-tool ${hidden_count > 0 ? "is-active" : ""} cursor-pointer flex-shrink-0`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" />
        </svg>
        <span className="hidden min-[420px]:inline">{translate("DCS_TABLE_HIDE_FIELDS")}</span>
        {hidden_count > 0 && <span style={{ color: PRIMARY, fontWeight: 700 }}>{hidden_count}</span>}
      </button>

      <MenuPopover open={open} anchorRef={trigger_ref} onClose={() => setOpen(false)} minWidth={250} maxHeight={420} align="start" role="menu">
        <div className="px-2.5 pt-2.5 pb-1.5">
          <p className="text-[11px] mb-2" style={{ color: "#6B7280", fontFamily: FONT }}>
            {canEdit ? translate("DCS_TABLE_HIDE_FIELDS_HINT") : translate("DCS_TABLE_HIDE_FIELDS_LOCKED")}
          </p>
          {canEdit && hideable.length > 0 && (
            <div className="flex items-center gap-2 mb-1">
              <button type="button" onClick={() => set_all(false)} disabled={saving} className="dcs-dt-tool cursor-pointer" style={{ height: 28, fontSize: 11 }}>
                {translate("DCS_TABLE_SHOW_ALL")}
              </button>
              <button type="button" onClick={() => set_all(true)} disabled={saving} className="dcs-dt-tool cursor-pointer" style={{ height: 28, fontSize: 11 }}>
                {translate("DCS_TABLE_HIDE_ALL")}
              </button>
            </div>
          )}
        </div>

        {hideable.length === 0 ? (
          <p className="px-2.5 pb-3 text-xs" style={{ color: "#9E9E9E", fontFamily: FONT }}>
            {translate("DCS_TABLE_HIDE_FIELDS_EMPTY")}
          </p>
        ) : (
          <div className="pb-2">
            {hideable.map((column) => (
              <CheckRow
                key={column.key}
                label={column.label !== undefined && column.label !== "" ? column.label : translate(column.labelKey)}
                hidden={hidden_set.has(column.key)}
                disabled={!canEdit || saving}
                onToggle={() => toggle(column.key)}
              />
            ))}
          </div>
        )}
      </MenuPopover>
    </>
  );
}
