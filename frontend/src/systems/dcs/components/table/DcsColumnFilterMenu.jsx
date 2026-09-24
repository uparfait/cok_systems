import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import MenuPopover from "../../util-dashboard/MenuPopover.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";

const FONT = "'Montserrat', sans-serif";

function Tick({ on }) {
  return (
    <span className={`dcs-dt-check-box ${on ? "is-on" : ""}`}>
      {on && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="4 12.5 9.5 18 20 6.5" />
        </svg>
      )}
    </span>
  );
}

/**
 * The filter that hangs under a choice column's own header. It lists every
 * value the column offers - what the records hold, each with how many rows
 * carry it, and every option of the field nobody picked yet at 0 - and
 * narrows the whole table to the ones ticked. Nothing ticked means "show
 * all", which is where every column starts.
 *
 * A cascade child (a sector under a district) lists only the values under
 * the parent values picked above it; changing the parent drops the
 * child's own picks, since they may no longer exist.
 *
 * The values are fetched the first time the menu is opened - the one time
 * a spinner shows - and kept from then on. When the date range or the
 * parent picks change they are fetched again SILENTLY: the list already
 * loaded stays on screen until the fresh one replaces it, so opening the
 * menu never flashes empty and never loses its state.
 */
export default function DcsColumnFilterMenu({ fieldId, selected, onChange, loadValues, rangeKey, parent }) {
  const { translate } = useDcsLanguage();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(null);
  const [loading, setLoading] = useState(false);
  const trigger_ref = useRef(null);
  const loaded_key_ref = useRef(null);
  const request_seq_ref = useRef(0);
  const parent_key_ref = useRef(null);

  const parent_key = parent && parent.field_id ? `${parent.field_id}=${JSON.stringify(parent.values || [])}` : "";
  const load_key = `${rangeKey}|${parent_key}`;
  const picked = new Set(selected || []);

  // The parent moved under this column: its own picks may point at values
  // that no longer exist, so they are let go.
  useEffect(() => {
    if (parent_key_ref.current === null) {
      parent_key_ref.current = parent_key;
      return;
    }
    if (parent_key_ref.current === parent_key) return;
    parent_key_ref.current = parent_key;
    if ((selected || []).length > 0) onChange([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent_key]);

  useEffect(() => {
    if (loaded_key_ref.current === load_key) return undefined;
    // Never read yet and still shut: wait for the first open.
    if (!open && !values) return undefined;
    const silent = !!values;
    const request_id = request_seq_ref.current + 1;
    request_seq_ref.current = request_id;
    if (!silent) setLoading(true);
    loadValues(fieldId, parent && parent.field_id ? parent : null)
      .then((list) => {
        if (request_seq_ref.current !== request_id) return;
        setValues(list);
        loaded_key_ref.current = load_key;
      })
      .catch(() => {
        // A silent refresh that fails keeps what is already shown.
        if (request_seq_ref.current === request_id && !silent) setValues([]);
      })
      .finally(() => {
        if (request_seq_ref.current === request_id && !silent) setLoading(false);
      });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, load_key, fieldId]);

  const toggle = (value) => {
    const next = new Set(picked);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(Array.from(next));
  };

  // What is actually being shown, in words - a bare count told nobody
  // WHICH values a narrowed column was narrowed to.
  const chosen = (selected || []).map((value) => String(value));
  const label = chosen.length === 0 ? translate("DCS_TABLE_COLUMN_FILTER_ALL") : chosen.join(", ");

  return (
    <>
      <button
        ref={trigger_ref}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((previous) => !previous);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`dcs-dt-colfilter ${picked.size > 0 ? "is-on" : ""} cursor-pointer`}
        title={label}
      >
        <span className="dcs-dt-colfilter-value">{label}</span>
        {chosen.length > 1 && <span className="dcs-dt-colfilter-count">{chosen.length}</span>}
        <svg width="8" height="5" viewBox="0 0 10 6" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <MenuPopover open={open} anchorRef={trigger_ref} onClose={() => setOpen(false)} minWidth={210} maxHeight={330} align="start" role="menu">
        <button
          type="button"
          onClick={() => onChange([])}
          className="dcs-dt-check cursor-pointer"
          style={{ fontWeight: picked.size === 0 ? 700 : 500, color: picked.size === 0 ? "#056daa" : "#333333" }}
        >
          <Tick on={picked.size === 0} />
          <span>{translate("DCS_TABLE_COLUMN_FILTER_ALL")}</span>
        </button>

        {loading && (
          <div className="px-2.5 py-3">
            <SpiralLoader padded={false} size={18} />
          </div>
        )}

        {!loading && values && values.length === 0 && (
          <p className="px-2.5 py-3 text-xs" style={{ color: "#9E9E9E", fontFamily: FONT }}>
            {translate("DCS_TABLE_COLUMN_FILTER_NONE")}
          </p>
        )}

        {!loading &&
          (values || []).map((entry) => {
            const text = String(entry.value);
            const is_on = picked.has(entry.value);
            const is_empty = !entry.count;
            return (
              <button key={text} type="button" role="menuitemcheckbox" aria-checked={is_on} onClick={() => toggle(entry.value)} className="dcs-dt-check cursor-pointer" style={{ opacity: is_empty ? 0.6 : 1 }}>
                <Tick on={is_on} />
                <span className="min-w-0 flex-1 break-words">{text}</span>
                <span className="flex-shrink-0" style={{ color: is_empty ? "#B0B7BE" : "#9E9E9E", fontSize: 11, fontWeight: 600 }}>
                  {entry.count || 0}
                </span>
              </button>
            );
          })}
      </MenuPopover>
    </>
  );
}
