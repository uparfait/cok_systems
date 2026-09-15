import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import MenuPopover from "./MenuPopover.jsx";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";
const FONT = { fontFamily: "'Montserrat', sans-serif" };
const SURFACE = "var(--board-surface, #FFFFFF)";
const SURFACE_BORDER = "var(--board-border, #E0E0E0)";
const SURFACE_TEXT = "var(--board-text, #333333)";

const CHEVRON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/**
 * The board's whole control set behind one "Actions" dropdown, instead of
 * a row of bare icon buttons: every action is a row with its own icon and
 * a name, so what each one does is readable rather than guessed. An action
 * currently in force (dark mode, the fit or scroll view) is marked, and a
 * destructive one is drawn in red. Closes on outside click, on Escape, and
 * whenever an action is chosen.
 *
 * items: { key, label, icon, onClick, active, danger, disabled }
 */
export default function BoardActionsMenu({ items, onDark }) {
  const { translate } = useDcsLanguage();
  const [open, setOpen] = useState(false);
  const button_ref = useRef(null);

  const shown = (items || []).filter(Boolean);
  if (shown.length === 0) return null;

  const trigger_style = onDark
    ? { border: "1px solid rgba(255, 255, 255, 0.55)", color: "#FFFFFF", backgroundColor: open ? "rgba(255, 255, 255, 0.22)" : "transparent" }
    : { border: `1px solid ${PRIMARY}`, color: open ? "#FFFFFF" : PRIMARY, backgroundColor: open ? PRIMARY : SURFACE };

  return (
    <div className="flex-shrink-0">
      <button
        ref={button_ref}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="dcs-db-iconbtn flex items-center gap-2 px-3 text-xs font-bold uppercase cursor-pointer"
        style={{ height: 36, letterSpacing: "0.5px", ...FONT, ...trigger_style }}
      >
        {translate("DCS_DB_ACTIONS")}
        {CHEVRON}
      </button>
      <MenuPopover open={open} anchorRef={button_ref} onClose={() => setOpen(false)} minWidth={240}>
        <>
          {shown.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              aria-pressed={item.active ? true : undefined}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className="dcs-db-menu-item flex w-full items-center gap-2.5 px-3 py-2 text-xs font-semibold text-left cursor-pointer"
              style={{
                color: item.danger ? DANGER : item.active ? PRIMARY : SURFACE_TEXT,
                background: item.active ? "rgba(5,109,170,0.10)" : "none",
                border: "none",
                opacity: item.disabled ? 0.5 : 1,
                cursor: item.disabled ? "not-allowed" : "pointer",
                ...FONT,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                {item.icon}
              </svg>
              <span className="flex-1 min-w-0 break-words">{item.label}</span>
              {item.active && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <polyline points="4 12.5 10 18.5 20 6" />
                </svg>
              )}
            </button>
          ))}
          <style>{`.dcs-db-menu-item:hover:not(:disabled) { background-color: var(--board-surface-hover, #F0F7FB) !important; }`}</style>
        </>
      </MenuPopover>
    </div>
  );
}
