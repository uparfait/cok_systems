import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import MenuPopover from "../../util-dashboard/MenuPopover.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";

const FONT = "'Montserrat', sans-serif";

/**
 * The filter that hangs under a choice column's own header. It lists the
 * values that column has ACTUALLY collected (read from the records, not
 * from the schema - an option renamed in a later version still has rows
 * behind it), each with how many rows carry it, and narrows the whole
 * table to the ones ticked. Nothing ticked means "show all", which is
 * where every column starts.
 *
 * The values are fetched the first time the menu is opened and again
 * whenever the table's date range changes, since a value the visible
 * range has none of should not be on offer.
 */
export default function DcsColumnFilterMenu({ fieldId, selected, onChange, loadValues, rangeKey }) {
  const { translate } = useDcsLanguage();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(null);
  const [loading, setLoading] = useState(false);
  const trigger_ref = useRef(null);
  const loaded_range_ref = useRef(null);

  const picked = new Set(selected || []);

  useEffect(() => {
    if (!open) return undefined;
    if (loaded_range_ref.current === rangeKey && values) return undefined;
    let is_mounted = true;
    setLoading(true);
    loadValues(fieldId)
      .then((list) => {
        if (!is_mounted) return;
        setValues(list);
        loaded_range_ref.current = rangeKey;
      })
      .catch(() => is_mounted && setValues([]))
      .finally(() => is_mounted && setLoading(false));
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rangeKey, fieldId]);

  // A range change while the menu is shut still invalidates what was read.
  useEffect(() => {
    if (loaded_range_ref.current !== rangeKey) setValues(null);
  }, [rangeKey]);

  const toggle = (value) => {
    const next = new Set(picked);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(Array.from(next));
  };

  const label = picked.size === 0 ? translate("DCS_TABLE_COLUMN_FILTER_ALL") : `${picked.size}`;

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
        title={translate("DCS_TABLE_COLUMN_FILTER")}
        className={`dcs-dt-colfilter ${picked.size > 0 ? "is-on" : ""} cursor-pointer`}
      >
        <span className="truncate">{label}</span>
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
          <span className={`dcs-dt-check-box ${picked.size === 0 ? "is-on" : ""}`}>
            {picked.size === 0 && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="4 12.5 9.5 18 20 6.5" />
              </svg>
            )}
          </span>
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
            return (
              <button key={text} type="button" role="menuitemcheckbox" aria-checked={is_on} onClick={() => toggle(entry.value)} className="dcs-dt-check cursor-pointer">
                <span className={`dcs-dt-check-box ${is_on ? "is-on" : ""}`}>
                  {is_on && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="4 12.5 9.5 18 20 6.5" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0 flex-1 break-words">{text}</span>
                <span className="flex-shrink-0" style={{ color: "#9E9E9E", fontSize: 11, fontWeight: 600 }}>
                  {entry.count}
                </span>
              </button>
            );
          })}
      </MenuPopover>
    </>
  );
}
