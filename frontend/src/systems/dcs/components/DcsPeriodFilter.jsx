import React, { useState, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { portal_root } from "../util-dashboard/portalRoot.js";
import { useBoardTheme } from "../util-dashboard/boardTheme.jsx";
import MenuPopover from "../util-dashboard/MenuPopover.jsx";

// Outside a dashboard the board theme context is light, so these resolve to the usual colors.
const SURFACE = "var(--board-surface, #FFFFFF)";
const BORDER = "var(--board-border, #E0E0E0)";
const TEXT = "var(--board-text, #333333)";
const MUTED = "var(--board-muted, #6B7280)";

// Shared with DcsTableSearchSort's search input and sort toggle, so every
// control across the whole filter bar lines up at exactly the same height.
export const FILTER_CONTROL_HEIGHT_PX = 40;

const PERIOD_OPTIONS = [
  { value: "all", labelKey: "DCS_STATS_PERIOD_ALL" },
  { value: "today", labelKey: "DCS_STATS_PERIOD_TODAY" },
  { value: "this_week", labelKey: "DCS_STATS_PERIOD_THIS_WEEK" },
  { value: "this_month", labelKey: "DCS_STATS_PERIOD_THIS_MONTH" },
  { value: "last_month", labelKey: "DCS_STATS_PERIOD_LAST_MONTH" },
  { value: "this_year", labelKey: "DCS_STATS_PERIOD_THIS_YEAR" },
  { value: "custom", labelKey: "DCS_STATS_PERIOD_CUSTOM" },
];

function format_date(date_string) {
  if (!date_string) return "";
  const date = new Date(date_string + "T00:00:00");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function CustomDatePopup({ open, onOpenChange, from, to, onFromChange, onToChange, onApply, translate }) {
  const board = useBoardTheme();
  const [local_from, setLocalFrom] = useState(from || "");
  const [local_to, setLocalTo] = useState(to || "");

  const handle_apply = () => {
    onFromChange(local_from);
    onToChange(local_to);
    // The picked dates ride along directly: the parent's own from/to state
    // updates are asynchronous, so reading them inside onApply would still
    // see the values from BEFORE this apply (empty on the very first one -
    // the custom range then silently did nothing).
    onApply(local_from, local_to);
    onOpenChange(false);
  };

  const handle_open_change = (is_open) => {
    if (is_open) {
      setLocalFrom(from || "");
      setLocalTo(to || "");
    }
    onOpenChange(is_open);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handle_open_change}>
      <Dialog.Portal container={portal_root()}>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={`fixed top-1/2 left-1/2 z-50 w-full max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-none p-5 shadow-xl ${board.is_dark ? "dcs-board-dark dcs-board-dark-portal" : ""}`}
          style={{ backgroundColor: SURFACE, color: TEXT, border: `1px solid ${BORDER}` }}
        >
          <Dialog.Title className="text-sm font-semibold mb-3" style={{ fontFamily: "'Montserrat', sans-serif", color: TEXT }}>
            {translate("DCS_STATS_PERIOD_CUSTOM")}
          </Dialog.Title>

          <div className="mb-3">
            <div className="flex flex-col gap-2">
              <div>
                <label className="block text-xs mb-0.5" style={{ fontFamily: "'Montserrat', sans-serif", color: MUTED }}>From</label>
                <input
                  type="date"
                  value={local_from}
                  onChange={(event) => setLocalFrom(event.target.value)}
                  className="w-full border rounded-none px-2 py-1.5 text-sm cursor-pointer"
                  style={{ fontFamily: "'Montserrat', sans-serif", height: 36, backgroundColor: SURFACE, color: TEXT, borderColor: BORDER }}
                />
              </div>
              <div>
                <label className="block text-xs mb-0.5" style={{ fontFamily: "'Montserrat', sans-serif", color: MUTED }}>To</label>
                <input
                  type="date"
                  value={local_to}
                  onChange={(event) => setLocalTo(event.target.value)}
                  className="w-full border rounded-none px-2 py-1.5 text-sm cursor-pointer"
                  style={{ fontFamily: "'Montserrat', sans-serif", height: 36, backgroundColor: SURFACE, color: TEXT, borderColor: BORDER }}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 text-xs border rounded-none cursor-pointer"
              style={{ fontFamily: "'Montserrat', sans-serif", backgroundColor: SURFACE, color: TEXT, borderColor: BORDER }}
            >
              {translate("DCS_BTN_CANCEL")}
            </button>
            <button
              type="button"
              onClick={handle_apply}
              disabled={!local_from}
              className="px-3 py-1.5 text-xs text-white bg-[#056daa] rounded-none hover:bg-[#045a8c] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {translate("DCS_BTN_APPLY")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Shared date-range filter bar (chart and the submissions tables) - a
 * preset dropdown that opens a popup when "custom" is selected, keeping
 * the filter compact and responsive on every screen size.
 */
export default function DcsPeriodFilter({ period, onPeriodChange, from, onFromChange, to, onToChange, onApply, includeAll, allowWrap, locked, plain }) {
  const { translate } = useDcsLanguage();
  const [is_custom_open, setIsCustomOpen] = useState(false);
  const [is_menu_open, setIsMenuOpen] = useState(false);
  const menu_ref = useRef(null);
  const options = includeAll ? PERIOD_OPTIONS : PERIOD_OPTIONS.filter((option) => option.value !== "all");

  // A native <select> fires nothing when the already-selected option is
  // clicked again - this custom menu fires on EVERY click, so re-picking
  // the active period re-applies it (and re-picking "custom" reopens the
  // date popup) instead of doing nothing.
  const handle_option_click = (value) => {
    setIsMenuOpen(false);
    if (value === "custom") {
      onPeriodChange("custom");
      setIsCustomOpen(true);
      return;
    }
    if (value !== period) {
      // A real change - the consumer's own period effect fetches.
      onPeriodChange(value);
      return;
    }
    // Same option re-clicked: re-apply the current filter right now.
    if (onApply) onApply();
  };

  const option_label = (option) => (option.value === "custom" ? translate("DCS_STATS_PERIOD_CUSTOM") : translate(option.labelKey));
  const selected_option = options.find((option) => option.value === period);

  const get_selected_label = () => {
    if (period === "custom") {
      if (from && to) return `${format_date(from)} - ${format_date(to)}`;
      if (from) return `From ${format_date(from)}`;
      return translate("DCS_STATS_PERIOD_CUSTOM");
    }
    return "";
  };

  return (
    <div className={`flex items-center gap-2 ${allowWrap ? "flex-wrap" : "flex-row flex-shrink-0"}`}>
      <div className="relative flex-shrink-0">
        <button
          ref={menu_ref}
          type="button"
          onClick={locked ? undefined : () => setIsMenuOpen((previous) => !previous)}
          disabled={locked}
          title={locked ? translate("DCS_DB_FILTER_LOCKED") : undefined}
          className={
            plain
              ? `dcs-board-filter dcs-board-filter-period ${is_menu_open ? "is-open" : ""} ${locked ? "is-locked" : ""} ${period && period !== "this_year" && !locked ? "is-active" : ""}`
              : `cok-auth-input text-sm inline-flex items-center justify-between gap-2 ${locked ? "cursor-default" : "cursor-pointer"}`
          }
          style={plain ? { minWidth: 150 } : { fontFamily: "'Montserrat', sans-serif", height: FILTER_CONTROL_HEIGHT_PX, minHeight: FILTER_CONTROL_HEIGHT_PX, minWidth: 150, backgroundColor: "transparent", color: TEXT, borderColor: is_menu_open ? "#056daa" : BORDER, borderStyle: locked ? "dashed" : "solid" }}
        >
          <span className={plain ? "dcs-board-filter-value" : "truncate"}>{period === "custom" && from ? get_selected_label() : selected_option ? option_label(selected_option) : ""}</span>
          {!locked && <svg
            width="10"
            height="6"
            viewBox="0 0 10 6"
            style={{ flexShrink: 0, transform: is_menu_open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms ease" }}
          >
            <path d="M1 1l4 4 4-4" fill="none" stroke="#9E9E9E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>}
        </button>
        <MenuPopover open={is_menu_open} anchorRef={menu_ref} onClose={() => setIsMenuOpen(false)} minWidth={170} align="start" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === period}
              onClick={() => handle_option_click(option.value)}
              className="dcs-db-menu-item block w-full text-left text-sm cursor-pointer"
              style={{
                padding: "0.5rem 0.75rem",
                fontFamily: "'Montserrat', sans-serif",
                color: option.value === period ? "#056daa" : TEXT,
                fontWeight: option.value === period ? 700 : 400,
                background: "none",
                border: "none",
              }}
            >
              {option_label(option)}
            </button>
          ))}
        </MenuPopover>
      </div>


      <CustomDatePopup
        open={is_custom_open}
        onOpenChange={setIsCustomOpen}
        from={from}
        to={to}
        onFromChange={onFromChange}
        onToChange={onToChange}
        onApply={onApply}
        translate={translate}
      />
    </div>
  );
}
