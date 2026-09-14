import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { IconButton, CLOSE_SVG } from "../BoardIcons.jsx";
import DcsButtonOutlineDanger from "../../components/DcsButtonOutlineDanger.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";
import LibraryIcon from "./LibraryIcon.jsx";
import { ICON_LIBRARIES, parse_icon_id, icon_label, library_definition } from "./iconLibraries.js";
import { useIconLibraries, useIconIndex, filter_icon_index } from "./useIconLibraries.js";

const PRIMARY = "#056daa";
const BORDER = "#E0E0E0";
const TEXT_DARK = "#333333";
const TEXT_MUTED = "#9E9E9E";
const HEADING_FONT = { fontFamily: "'Montserrat', sans-serif" };
const PAGE = 144;
const ALL = "all";
const ALL_IDS = ICON_LIBRARIES.map((library) => library.id);

/**
 * The right-hand drawer opened by clicking a KPI card: the card's current
 * icon (with a way to remove it), a library filter, a search box and the
 * icons themselves in a grid. Searching always runs ACROSS every library
 * unless one is picked in the filter; libraries are fetched on demand and
 * results show up as each one lands. The grid renders in pages that grow
 * as it is scrolled. Picking an icon saves it at once and closes the drawer.
 */
export default function IconPickerPanel({ widget, saving, onPick, onRemove, onClose }) {
  const { translate } = useDcsLanguage();
  const [library, setLibrary] = useState(ALL);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  const wanted_ids = useMemo(() => (library === ALL ? ALL_IDS : [library]), [library]);
  const { loaded, failed, pending } = useIconLibraries(wanted_ids);
  const index = useIconIndex(loaded, wanted_ids);
  const matches = useMemo(() => filter_icon_index(index, query), [index, query]);
  const visible = matches.slice(0, shown);

  const current = widget && widget.icon ? widget.icon : null;
  const current_parsed = parse_icon_id(current);
  const current_library = current_parsed ? library_definition(current_parsed.library) : null;

  const handle_scroll = (event) => {
    const element = event.currentTarget;
    if (shown < matches.length && element.scrollTop + element.clientHeight >= element.scrollHeight - 240) {
      setShown((count) => count + PAGE);
    }
  };

  const reset_page = () => setShown(PAGE);
  const count_of = (id) => (loaded[id] ? loaded[id].names.length : null);

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={saving ? undefined : onClose} />
      <aside
        className="relative h-full w-full flex flex-col bg-white"
        style={{ maxWidth: 420, borderLeft: `2px solid ${PRIMARY}`, boxShadow: "-8px 0 24px rgba(0,0,0,0.12)" }}
      >
        <div className="flex items-center justify-between gap-2 flex-shrink-0 px-4 py-2" style={{ backgroundColor: PRIMARY }}>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase leading-tight truncate" style={{ color: "#FFFFFF", letterSpacing: "0.3px", ...HEADING_FONT }}>
              {translate(current ? "DCS_DB_ICON_CHANGE" : "DCS_DB_ICON_SET")}
            </p>
            <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)", ...HEADING_FONT }}>
              {widget ? widget.title : ""}
            </p>
          </div>
          <IconButton title={translate("DCS_BTN_CLOSE")} onClick={onClose} onDark danger disabled={saving}>
            {CLOSE_SVG}
          </IconButton>
        </div>

        <div className="flex-shrink-0 px-4 pt-3 pb-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: TEXT_MUTED, ...HEADING_FONT }}>
            {translate("DCS_DB_ICON_CURRENT")}
          </p>
          <div className="flex items-center gap-3">
            <span
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 44, height: 44, border: `1px solid ${current ? PRIMARY : BORDER}`, color: PRIMARY, backgroundColor: current ? "#EAF3F8" : "#FFFFFF" }}
            >
              {current ? <LibraryIcon icon={current} size={26} color={PRIMARY} /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate" style={{ color: TEXT_DARK, ...HEADING_FONT }}>
                {current_parsed ? icon_label(current_parsed.name, current_parsed.library) : translate("DCS_DB_ICON_NO_CURRENT")}
              </p>
              {current_parsed && (
                <p className="text-xs truncate" style={{ color: TEXT_MUTED }}>
                  {current_library ? current_library.label : current_parsed.library} - {current_parsed.name}
                </p>
              )}
            </div>
            {current && (
              <DcsButtonOutlineDanger className="w-36" type="button" disabled={saving} onClick={onRemove}>
                {translate("DCS_DB_ICON_REMOVE")}
              </DcsButtonOutlineDanger>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <select
              className="cok-auth-input w-full sm:w-44 py-2 flex-shrink-0"
              value={library}
              onChange={(event) => {
                setLibrary(event.target.value);
                reset_page();
              }}
            >
              <option value={ALL}>{translate("DCS_DB_ICON_ALL_LIBRARIES")}</option>
              {ICON_LIBRARIES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                  {count_of(entry.id) !== null ? ` (${count_of(entry.id)})` : ""}
                </option>
              ))}
            </select>
            <input
              className="cok-auth-input w-full py-2"
              value={query}
              placeholder={translate("DCS_DB_ICON_SEARCH")}
              onChange={(event) => {
                setQuery(event.target.value);
                reset_page();
              }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: TEXT_MUTED }}>
            {translate("DCS_DB_ICON_COUNT", { count: matches.length })}
            {pending > 0 ? ` - ${translate("DCS_DB_ICON_LOADING_LIBS", { done: wanted_ids.length - pending, total: wanted_ids.length })}` : ""}
            {pending === 0 ? ` - ${translate("DCS_DB_ICON_HINT")}` : ""}
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3" onScroll={handle_scroll}>
          {saving ? (
            <div className="flex items-center justify-center py-10">
              <SpiralLoader />
            </div>
          ) : matches.length === 0 && pending > 0 ? (
            <div className="flex items-center justify-center py-10">
              <SpiralLoader />
            </div>
          ) : matches.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: TEXT_MUTED }}>
              {Object.keys(failed).length === wanted_ids.length ? translate("DCS_DB_ICON_LOAD_FAILED") : translate("DCS_DB_ICON_NONE")}
            </p>
          ) : (
            <div className="grid grid-cols-6 gap-1">
              {visible.map((entry) => {
                const selected = entry.id === current;
                const source = loaded[entry.library];
                return (
                  <button
                    key={entry.id}
                    type="button"
                    title={`${entry.label} - ${entry.library_label}`}
                    aria-label={`${entry.label} - ${entry.library_label}`}
                    aria-pressed={selected}
                    className="dcs-db-icon-choice flex items-center justify-center cursor-pointer"
                    style={{
                      height: 48,
                      border: `1px solid ${selected ? PRIMARY : BORDER}`,
                      backgroundColor: selected ? PRIMARY : "#FFFFFF",
                      color: selected ? "#FFFFFF" : TEXT_DARK,
                    }}
                    onClick={() => onPick(entry.id)}
                  >
                    {source ? source.render(entry.name, { size: 22, color: selected ? "#FFFFFF" : TEXT_DARK }) : null}
                  </button>
                );
              })}
            </div>
          )}
          {pending > 0 && matches.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-3">
              <SpiralLoader padded={false} size={16} />
              <span className="text-xs" style={{ color: TEXT_MUTED }}>
                {translate("DCS_DB_ICON_LOADING_LIBS", { done: wanted_ids.length - pending, total: wanted_ids.length })}
              </span>
            </div>
          )}
          <style>{`.dcs-db-icon-choice:hover { border-color: ${PRIMARY} !important; color: ${PRIMARY} !important; background-color: #EAF3F8 !important; }`}</style>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
