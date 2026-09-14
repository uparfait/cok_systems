import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { IconButton, CLOSE_SVG } from "../BoardIcons.jsx";
import DcsButtonOutlineDanger from "../../components/DcsButtonOutlineDanger.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";
import { useTablerIcons } from "./TablerIcon.jsx";
import { list_icon_names, filter_icon_names, icon_label } from "./tablerIcons.js";

const PRIMARY = "#056daa";
const BORDER = "#E0E0E0";
const TEXT_DARK = "#333333";
const TEXT_MUTED = "#9E9E9E";
const HEADING_FONT = { fontFamily: "'Montserrat', sans-serif" };
const PAGE = 144;

/**
 * The right-hand drawer opened by clicking a KPI card: the card's current
 * icon (with a way to remove it), a search box and the COMPLETE Tabler icon
 * set in a grid. The set is several thousand icons, so the grid renders in
 * pages that grow as the list is scrolled. Picking an icon saves it on the
 * widget at once and closes the drawer.
 */
export default function IconPickerPanel({ widget, saving, onPick, onRemove, onClose }) {
  const { translate } = useDcsLanguage();
  const module = useTablerIcons();
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  const all_names = useMemo(() => (module ? list_icon_names(module) : []), [module]);
  const matches = useMemo(() => filter_icon_names(all_names, query), [all_names, query]);
  const visible = matches.slice(0, shown);
  const current = widget && widget.icon ? widget.icon : null;
  const Current = current && module ? module[current] : null;

  const handle_scroll = (event) => {
    const element = event.currentTarget;
    if (shown < matches.length && element.scrollTop + element.clientHeight >= element.scrollHeight - 240) {
      setShown((count) => count + PAGE);
    }
  };

  const handle_query = (value) => {
    setQuery(value);
    setShown(PAGE);
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={saving ? undefined : onClose} />
      <aside
        className="relative h-full w-full flex flex-col bg-white"
        style={{ maxWidth: 400, borderLeft: `2px solid ${PRIMARY}`, boxShadow: "-8px 0 24px rgba(0,0,0,0.12)" }}
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

        <div className="flex-shrink-0 px-4 pt-3 pb-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: TEXT_MUTED, ...HEADING_FONT }}>
            {translate("DCS_DB_ICON_CURRENT")}
          </p>
          <div className="flex items-center gap-3">
            <span
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 44, height: 44, border: `1px solid ${current ? PRIMARY : BORDER}`, color: PRIMARY, backgroundColor: current ? "#EAF3F8" : "#FFFFFF" }}
            >
              {Current ? <Current size={26} stroke={1.8} aria-hidden="true" /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate" style={{ color: TEXT_DARK, ...HEADING_FONT }}>
                {current ? icon_label(current) : translate("DCS_DB_ICON_NO_CURRENT")}
              </p>
              {current && (
                <p className="text-xs truncate" style={{ color: TEXT_MUTED }}>
                  {current}
                </p>
              )}
            </div>
            {current && (
              <DcsButtonOutlineDanger className="w-36" type="button" disabled={saving} onClick={onRemove}>
                {translate("DCS_DB_ICON_REMOVE")}
              </DcsButtonOutlineDanger>
            )}
          </div>
          <input
            className="cok-auth-input w-full py-2 mt-3"
            value={query}
            placeholder={translate("DCS_DB_ICON_SEARCH")}
            disabled={!module}
            onChange={(event) => handle_query(event.target.value)}
          />
          <p className="text-xs mt-2" style={{ color: TEXT_MUTED }}>
            {module ? translate("DCS_DB_ICON_COUNT", { count: matches.length }) : translate("DCS_DB_ICON_LOADING")}
            {module ? ` - ${translate("DCS_DB_ICON_HINT")}` : ""}
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3" onScroll={handle_scroll}>
          {!module ? (
            <div className="flex items-center justify-center py-10">
              <SpiralLoader />
            </div>
          ) : saving ? (
            <div className="flex items-center justify-center py-10">
              <SpiralLoader />
            </div>
          ) : matches.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: TEXT_MUTED }}>
              {translate("DCS_DB_ICON_NONE")}
            </p>
          ) : (
            <div className="grid grid-cols-6 gap-1">
              {visible.map((name) => {
                const Component = module[name];
                const selected = name === current;
                return (
                  <button
                    key={name}
                    type="button"
                    title={icon_label(name)}
                    aria-label={icon_label(name)}
                    aria-pressed={selected}
                    className="dcs-db-icon-choice flex items-center justify-center cursor-pointer"
                    style={{
                      height: 48,
                      border: `1px solid ${selected ? PRIMARY : BORDER}`,
                      backgroundColor: selected ? PRIMARY : "#FFFFFF",
                      color: selected ? "#FFFFFF" : TEXT_DARK,
                    }}
                    onClick={() => onPick(name)}
                  >
                    <Component size={22} stroke={1.7} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
          <style>{`.dcs-db-icon-choice:hover { border-color: ${PRIMARY} !important; color: ${PRIMARY} !important; background-color: #EAF3F8 !important; }`}</style>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
