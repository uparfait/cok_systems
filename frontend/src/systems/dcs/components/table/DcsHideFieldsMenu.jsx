import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import MenuPopover from "../../util-dashboard/MenuPopover.jsx";
import DcsButtonPrimary from "../DcsButtonPrimary.jsx";
import DcsButtonOutline from "../DcsButtonOutline.jsx";

const PRIMARY = "#056daa";
const FONT = "'Montserrat', sans-serif";

/**
 * "Hide fields": one tick per column the table could show - the form's
 * own questions and the columns the system adds (approval, version, who
 * submitted, when). A ticked column is hidden, and it is hidden for
 * EVERYONE who opens this table until it is unticked again, which is why
 * the set is saved on the server rather than in this browser.
 *
 * Because the change lands on every other reader, ticking a box does not
 * save it: the ticks are gathered here and only written when Save is
 * pressed, so a list can be worked through - and thought better of -
 * without anybody else's table flickering column by column. Cancel puts
 * back whatever was saved, and so does closing the panel any other way.
 *
 * Someone who may only read the form still sees the list and what is
 * currently hidden, but cannot change it.
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

function same_set(left, right) {
  if (left.length !== right.length) return false;
  const other = new Set(right);
  return left.every((key) => other.has(key));
}

export default function DcsHideFieldsMenu({ columns, hidden, canEdit, saving, onChange }) {
  const { translate } = useDcsLanguage();
  const [open, setOpen] = useState(false);
  // What the ticks currently say, before anybody has pressed Save.
  const [draft, setDraft] = useState(hidden || []);
  const trigger_ref = useRef(null);

  const hideable = (columns || []).filter((column) => column.key !== "actions");
  const saved_set = new Set(hidden || []);
  const draft_set = new Set(draft);
  const is_dirty = !same_set(draft, hidden || []);

  // The saved set is the starting point each time the panel opens, and it
  // also wins whenever it changes underneath (another tab, a failed save
  // that rolled back) while nothing is being edited here.
  useEffect(() => {
    if (!open) setDraft(hidden || []);
  }, [open, hidden]);

  const toggle = (key) => {
    if (!canEdit) return;
    const next = new Set(draft_set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setDraft(Array.from(next));
  };

  const set_all = (hide_them) => {
    if (!canEdit) return;
    setDraft(hide_them ? hideable.map((column) => column.key) : []);
  };

  const cancel = () => {
    setDraft(hidden || []);
    setOpen(false);
  };

  const save = () => {
    onChange(draft);
    setOpen(false);
  };

  const hidden_count = hideable.filter((column) => saved_set.has(column.key)).length;

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

      <MenuPopover open={open} anchorRef={trigger_ref} onClose={cancel} minWidth={260} maxHeight={460} align="start" role="menu">
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
                hidden={draft_set.has(column.key)}
                disabled={!canEdit || saving}
                onToggle={() => toggle(column.key)}
              />
            ))}
          </div>
        )}

        {/* Sticky, so a long list of columns never scrolls the only way
            of committing the ticks out of sight. */}
        {canEdit && hideable.length > 0 && (
          <div
            className="sticky bottom-0 flex items-center gap-2 px-2.5 py-2.5"
            style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #E0E0E0" }}
          >
            <div className="flex-1">
              <DcsButtonOutline onClick={cancel} disabled={saving}>
                {translate("DCS_BTN_CANCEL")}
              </DcsButtonOutline>
            </div>
            <div className="flex-1">
              <DcsButtonPrimary onClick={save} disabled={saving || !is_dirty}>
                {translate("DCS_BTN_SAVE")}
              </DcsButtonPrimary>
            </div>
          </div>
        )}
      </MenuPopover>
    </>
  );
}
