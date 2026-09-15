import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";

const PRIMARY = "#056daa";
const BORDER = "#E0E0E0";
const TEXT_DARK = "#333333";
const TEXT_MUTED = "#9E9E9E";
const HEADING_FONT = { fontFamily: "'Montserrat', sans-serif" };
const LIST_MAX_HEIGHT = 280;

function highlight(text, query) {
  if (!query) return text;
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at === -1) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark style={{ backgroundColor: "rgba(5,109,170,0.16)", color: "inherit", padding: 0 }}>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

/**
 * The builder's field picker: a solid trigger showing the chosen field (or
 * the placeholder) and, on click, a popover rendered on document.body -
 * never clipped by the scrolling composer - with a search box that filters
 * as you type, highlighted matches, a live "n of total" count, keyboard
 * navigation (arrows, Enter, Escape) and an optional "None" row.
 */
export default function BuilderFieldSelect({ options, value, onChange, placeholder, disabled, allowClear }) {
  const { translate } = useDcsLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [rect, setRect] = useState(null);
  const trigger_ref = useRef(null);
  const popover_ref = useRef(null);
  const input_ref = useRef(null);

  const selected = (options || []).find((option) => option.id === value) || null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options || [];
    return (options || []).filter((option) => option.name.toLowerCase().includes(needle) || String(option.badge || "").toLowerCase().includes(needle));
  }, [options, query]);

  const place = () => {
    const element = trigger_ref.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const below = window.innerHeight - box.bottom;
    const opens_up = below < LIST_MAX_HEIGHT + 80 && box.top > below;
    setRect({ left: box.left, width: box.width, top: opens_up ? null : box.bottom + 4, bottom: opens_up ? window.innerHeight - box.top + 4 : null });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    const on_change = () => place();
    window.addEventListener("resize", on_change);
    window.addEventListener("scroll", on_change, true);
    return () => {
      window.removeEventListener("resize", on_change);
      window.removeEventListener("scroll", on_change, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const on_outside = (event) => {
      if (trigger_ref.current && trigger_ref.current.contains(event.target)) return;
      if (popover_ref.current && popover_ref.current.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", on_outside);
    window.setTimeout(() => input_ref.current && input_ref.current.focus(), 0);
    return () => document.removeEventListener("mousedown", on_outside);
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query, open]);

  const pick = (id) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const toggle = () => {
    if (disabled) return;
    setQuery("");
    setOpen((current) => !current);
  };

  const rows = (allowClear ? [{ id: "", name: translate("DCS_SEARCH_NONE_OPTION"), none: true }] : []).concat(filtered);

  const on_key = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((current) => Math.min(rows.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (rows[cursor]) pick(rows[cursor].id);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  useEffect(() => {
    const list = popover_ref.current && popover_ref.current.querySelector(`[data-index="${cursor}"]`);
    if (list && list.scrollIntoView) list.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  return (
    <>
      <button
        ref={trigger_ref}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="dcs-builder-select w-full flex items-center justify-between gap-2 text-left px-3 cursor-pointer disabled:cursor-not-allowed"
        style={{ minHeight: 42, backgroundColor: disabled ? "#F7F9FB" : "#FFFFFF", border: `2px solid ${open ? PRIMARY : selected ? "rgba(5,109,170,0.45)" : BORDER}`, ...HEADING_FONT }}
      >
        <span className="min-w-0 flex items-center gap-2">
          <span className="truncate text-sm" style={{ color: selected ? TEXT_DARK : TEXT_MUTED, fontWeight: selected ? 600 : 500 }} title={selected ? selected.name : placeholder}>
            {selected ? selected.name : placeholder}
          </span>
          {selected && selected.badge && (
            <span className="flex-shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5" style={{ backgroundColor: "#EAF3F8", color: PRIMARY, letterSpacing: "0.4px" }}>
              {selected.badge}
            </span>
          )}
        </span>
        <span className="flex-shrink-0 text-[11px] font-bold uppercase" style={{ color: PRIMARY, letterSpacing: "0.4px" }}>
          {selected ? translate("DCS_BTN_CHANGE") : translate("DCS_DB_SELECT_OPEN")}
        </span>
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={popover_ref}
            className="dcs-builder-popover fixed flex flex-col bg-white"
            role="listbox"
            style={{
              left: rect.left,
              width: rect.width,
              top: rect.top === null ? undefined : rect.top,
              bottom: rect.bottom === null ? undefined : rect.bottom,
              zIndex: 10050,
              border: `2px solid ${PRIMARY}`,
              boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            }}
          >
            <div className="p-2" style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: "#FFFFFF" }}>
              <input
                ref={input_ref}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={on_key}
                placeholder={translate("DCS_DB_SELECT_SEARCH")}
                className="w-full text-sm px-3 py-2 outline-none"
                style={{ border: `1px solid ${BORDER}`, color: TEXT_DARK, backgroundColor: "#FFFFFF", ...HEADING_FONT }}
              />
              <p className="text-[11px] mt-1 px-1" style={{ color: TEXT_MUTED }}>
                {translate("DCS_DB_SELECT_COUNT", { shown: filtered.length, total: (options || []).length })}
              </p>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: LIST_MAX_HEIGHT, backgroundColor: "#FFFFFF" }}>
              {rows.length === 0 ? (
                <p className="text-sm px-3 py-3" style={{ color: TEXT_MUTED }}>
                  {translate("DCS_SEARCH_NO_RESULTS")}
                </p>
              ) : (
                rows.map((option, index) => {
                  const active = index === cursor;
                  const chosen = option.id === value && !option.none;
                  return (
                    <div
                      key={option.id || "__none__"}
                      data-index={index}
                      role="option"
                      aria-selected={chosen}
                      onMouseEnter={() => setCursor(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => pick(option.id)}
                      className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer text-sm"
                      style={{
                        backgroundColor: active ? "#EAF3F8" : "#FFFFFF",
                        color: chosen ? PRIMARY : option.none ? TEXT_MUTED : TEXT_DARK,
                        fontWeight: chosen ? 700 : 500,
                        borderLeft: `3px solid ${chosen ? PRIMARY : "transparent"}`,
                        ...HEADING_FONT,
                      }}
                    >
                      <span className="truncate" title={option.name}>
                        {option.none ? option.name : highlight(option.name, query.trim())}
                      </span>
                      {option.badge && (
                        <span className="flex-shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5" style={{ backgroundColor: active ? "#FFFFFF" : "#F1F5F8", color: TEXT_MUTED, letterSpacing: "0.4px" }}>
                          {option.badge}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
