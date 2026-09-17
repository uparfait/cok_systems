import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import MenuPopover from "../MenuPopover.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";

const CHEVRON = (
  <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
    <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SEARCH_FROM = 8;

/**
 * One board filter as a self-made select: the field's name as its title
 * and the picked value (or "All") in the box, listing the values the field
 * holds RIGHT NOW - under the period and the other filters, so a sector
 * filter under a chosen district lists that district's sectors only - with
 * a search box once the list is long. A value is listed by NAME ALONE: how
 * many records carry it is a board answer, not a filter one, and a count
 * beside every choice only invited reading the dropdown as data.
 *
 * The list is either handed in (`values`, preloaded and refreshed by the
 * bar; `onOpen` asks for a silent
 * refresh) or fetched here on first open (`fetchValues`) and then kept, so
 * a filter that has loaded once never shows a spinner again. A locked
 * filter (a share link that fixes it) shows its value and cannot be opened.
 *
 * While a fresh list is on its way (`loading`) the filter says so with a
 * small spinner where its arrow is, and that is all: a filter that already
 * holds a list keeps it on screen and stays pickable, so opening one never
 * waits and never flickers. A cascade child is the exception - when its
 * parent changes, the bar takes its list away, and with nothing it can
 * trust it shows the loader and offers nothing until its own values land.
 * Picking one of the previous parent's values would filter the board by
 * something that does not exist under the new one.
 */
export default function FilterValueSelect({ label, value, onChange, values, onOpen, fetchValues, locked, disabled, waitHint, allLabel, loading }) {
  // What the empty choice is called: "All" on a board, "Default" when fixing a link.
  const all_text = allLabel || null;
  const { translate } = useDcsLanguage();
  const anchor_ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [own_values, setOwnValues] = useState(null);
  const [query, setQuery] = useState("");
  const has_value = value !== "" && value !== null && value !== undefined;
  const list = values !== undefined ? values : own_values;
  // Waiting is having NOTHING that can be trusted - a filter opened for the
  // first time, or a cascade child whose parent has just changed. A filter
  // that already holds a list keeps showing it and refreshes underneath, so
  // opening one never waits and never flickers.
  const waiting = !Array.isArray(list);
  const refreshing = loading === true && !waiting;
  const shown_values = Array.isArray(list) ? list : [];

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    if (onOpen) onOpen();
    if (!fetchValues) return undefined;
    let is_mounted = true;
    Promise.resolve(fetchValues())
      .then((entries) => is_mounted && setOwnValues(Array.isArray(entries) ? entries : []))
      .catch(() => is_mounted && setOwnValues((current) => current || []));
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (next) => {
    setOpen(false);
    if (String(next) !== String(has_value ? value : "")) onChange(next);
  };

  const shown = query.trim() ? shown_values.filter((entry) => String(entry.value).toLowerCase().includes(query.trim().toLowerCase())) : shown_values;
  // The current value stays selectable even when no record carries it any more.
  const current_listed = waiting || !has_value || shown_values.some((entry) => String(entry.value) === String(value));

  return (
    <>
      <button
        ref={anchor_ref}
        type="button"
        className={`dcs-board-filter ${has_value ? "is-active" : ""} ${open ? "is-open" : ""} ${locked ? "is-locked" : ""} ${waitHint ? "is-waiting" : ""} ${(waiting || refreshing) && !locked ? "is-loading" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled || locked}
        title={locked ? translate("DCS_DB_FILTER_LOCKED") : waitHint || label}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="dcs-board-filter-label">{label}</span>
        <span className="dcs-board-filter-value">{has_value ? String(value) : waitHint || all_text || translate("DCS_DB_FILTER_ALL")}</span>
        {!locked && (waiting || refreshing ? <span className="dcs-board-filter-busy" aria-hidden="true" /> : <span className="dcs-board-filter-chevron">{CHEVRON}</span>)}
      </button>
      <MenuPopover open={open} anchorRef={anchor_ref} onClose={() => setOpen(false)} minWidth={240} maxHeight={400} align="start" role="listbox">
        <div className="dcs-board-switcher-head">
          <span>{label}</span>
          <span>{waiting || refreshing ? translate("DCS_DB_FILTER_LOADING") : ""}</span>
        </div>
        {shown_values.length >= SEARCH_FROM && !waiting && (
          <div className="dcs-board-filter-search">
            <input value={query} autoFocus placeholder={translate("DCS_DB_FILTER_SEARCH")} onChange={(event) => setQuery(event.target.value)} />
          </div>
        )}
        <ul className="dcs-board-switcher-list">
          <li>
            <button type="button" role="option" aria-selected={!has_value} disabled={waiting} className={`dcs-board-switcher-item ${!has_value ? "is-active" : ""}`} onClick={() => pick("")}>
              <span className="min-w-0 flex-1">
                <span className="dcs-board-switcher-item-name">{all_text || translate("DCS_DB_FILTER_ALL")}</span>
                {all_text && <span className="dcs-board-switcher-item-meta">{translate("DCS_DB_SHARE_DEFAULT_HINT")}</span>}
              </span>
            </button>
          </li>
          {waiting ? (
            <li className="flex justify-center py-4">
              <SpiralLoader />
            </li>
          ) : (
            <>
              {!current_listed && !query.trim() && (
                <li>
                  <button type="button" role="option" aria-selected className="dcs-board-switcher-item is-active" onClick={() => pick(value)}>
                    <span className="min-w-0 flex-1">
                      <span className="dcs-board-switcher-item-name">{String(value)}</span>
                      <span className="dcs-board-switcher-item-meta">{translate("DCS_DB_FILTER_NO_RECORDS")}</span>
                    </span>
                  </button>
                </li>
              )}
              {shown.map((entry) => {
                const selected = has_value && String(entry.value) === String(value);
                return (
                  <li key={String(entry.value)}>
                    <button type="button" role="option" aria-selected={selected} className={`dcs-board-switcher-item ${selected ? "is-active" : ""}`} onClick={() => pick(entry.value)}>
                      <span className="min-w-0 flex-1">
                        <span className="dcs-board-switcher-item-name">{String(entry.value)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {shown.length === 0 && <li className="dcs-board-switcher-empty">{translate("DCS_DB_FILTER_NO_VALUES")}</li>}
            </>
          )}
        </ul>
      </MenuPopover>
    </>
  );
}
