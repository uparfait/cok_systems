import React, { useEffect, useState, useRef } from "react";
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
const PRIMARY = "#056daa";
const FONT = "'Montserrat', sans-serif";

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

const has_time = (text) => /T\d{2}:\d{2}/.test(String(text || ""));
const day_part = (text) => String(text || "").slice(0, 10);

/** A picked moment as a short label: the day, and the time when one was picked. */
function format_date(date_string) {
  if (!date_string) return "";
  const timed = has_time(date_string);
  const date = new Date(timed ? date_string : date_string + "T00:00:00");
  if (Number.isNaN(date.getTime())) return "";
  if (!timed) return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Segment({ options, value, onChange }) {
  return (
    <div className="flex border" style={{ borderColor: BORDER }}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className="flex-1 text-xs font-bold uppercase py-2 cursor-pointer"
          style={{ fontFamily: FONT, letterSpacing: 0.4, backgroundColor: option.value === value ? PRIMARY : "transparent", color: option.value === value ? "#FFFFFF" : MUTED, border: "none" }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PickerInput({ label, type, value, onChange }) {
  return (
    <div>
      <label className="block text-xs mb-0.5" style={{ fontFamily: FONT, color: MUTED }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border rounded-none px-2 py-1.5 text-sm cursor-pointer"
        style={{ fontFamily: FONT, height: 36, backgroundColor: SURFACE, color: TEXT, borderColor: BORDER }}
      />
    </div>
  );
}

/**
 * The custom range: ONE DAY (a single date, the whole day) or BETWEEN two
 * moments, with a switch to pick the time as well as the date. The
 * picked values ride along with Apply directly, since the parent's own
 * from/to state is not updated yet at that moment.
 */
function CustomDatePopup({ open, onOpenChange, onCancel, from, to, onFromChange, onToChange, onApply, translate }) {
  const board = useBoardTheme();
  const [mode, setMode] = useState(from && to && from === to ? "day" : "range");
  const [with_time, setWithTime] = useState(has_time(from) || has_time(to));
  const [local_from, setLocalFrom] = useState(from || "");
  const [local_to, setLocalTo] = useState(to || "");

  // Seeded from the applied range every time the popup opens. This popup is
  // opened from the period menu, and Radix never reports an open it did not
  // cause itself, so doing this in onOpenChange left the pickers showing
  // whatever they happened to hold when the control first mounted.
  useEffect(() => {
    if (!open) return;
    setMode(from && to && from === to ? "day" : "range");
    setWithTime(has_time(from) || has_time(to));
    setLocalFrom(from || "");
    setLocalTo(to || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape, the backdrop and the Cancel button all mean the same thing: no
  // range was picked. Apply closes itself, so it never comes through here.
  const handle_open_change = (is_open) => {
    if (!is_open) onCancel();
  };

  // Turning the time off keeps the days that were picked; turning it on
  // starts each moment at the beginning of its day.
  const change_with_time = (on) => {
    setWithTime(on);
    setLocalFrom((current) => (current ? (on ? `${day_part(current)}T00:00` : day_part(current)) : current));
    setLocalTo((current) => (current ? (on ? `${day_part(current)}T23:59` : day_part(current)) : current));
  };

  const handle_apply = () => {
    const next_from = mode === "day" ? day_part(local_from) : local_from;
    const next_to = mode === "day" ? day_part(local_from) : local_to;
    onFromChange(next_from);
    onToChange(next_to);
    onApply(next_from, next_to);
    onOpenChange(false);
  };

  const input_type = mode === "range" && with_time ? "datetime-local" : "date";
  const from_value = input_type === "date" ? day_part(local_from) : local_from;
  const to_value = input_type === "date" ? day_part(local_to) : local_to;

  return (
    <Dialog.Root open={open} onOpenChange={handle_open_change}>
      <Dialog.Portal container={portal_root()}>
        {/* Above the expanded table (100) and the dialogs (10000), like every other menu of the module. */}
        <Dialog.Overlay className="fixed inset-0 z-[10060] bg-black/40" />
        <Dialog.Content
          className={`fixed top-1/2 left-1/2 z-[10060] w-full max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-none p-5 shadow-xl ${board.is_dark ? "dcs-board-dark dcs-board-dark-portal" : ""}`}
          style={{ backgroundColor: SURFACE, color: TEXT, border: `1px solid ${BORDER}` }}
        >
          <Dialog.Title className="text-sm font-semibold mb-3" style={{ fontFamily: FONT, color: TEXT }}>
            {translate("DCS_STATS_PERIOD_CUSTOM")}
          </Dialog.Title>

          <div className="flex flex-col gap-3 mb-3">
            <Segment
              value={mode}
              onChange={setMode}
              options={[
                { value: "day", label: translate("DCS_PERIOD_MODE_DAY") },
                { value: "range", label: translate("DCS_PERIOD_MODE_RANGE") },
              ]}
            />

            {mode === "day" ? (
              <PickerInput label={translate("DCS_PERIOD_DAY_LABEL")} type="date" value={day_part(local_from)} onChange={setLocalFrom} />
            ) : (
              <>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ fontFamily: FONT, color: TEXT }}>
                  <input type="checkbox" checked={with_time} onChange={(event) => change_with_time(event.target.checked)} style={{ accentColor: PRIMARY }} />
                  {translate("DCS_PERIOD_WITH_TIME")}
                </label>
                <PickerInput label={translate("DCS_PERIOD_FROM")} type={input_type} value={from_value} onChange={setLocalFrom} />
                <PickerInput label={translate("DCS_PERIOD_TO")} type={input_type} value={to_value} onChange={setLocalTo} />
              </>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs border rounded-none cursor-pointer"
              style={{ fontFamily: FONT, backgroundColor: SURFACE, color: TEXT, borderColor: BORDER }}
            >
              {translate("DCS_BTN_CANCEL")}
            </button>
            <button
              type="button"
              onClick={handle_apply}
              disabled={!local_from}
              className="px-3 py-1.5 text-xs text-white bg-[#056daa] rounded-none hover:bg-[#045a8c] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ fontFamily: FONT }}
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
  // What was showing before "custom" was picked, so abandoning the date
  // popup can put the control back to it.
  const period_before_custom_ref = useRef(period);
  const options = includeAll ? PERIOD_OPTIONS : PERIOD_OPTIONS.filter((option) => option.value !== "all");

  // A native <select> fires nothing when the already-selected option is
  // clicked again - this custom menu fires on EVERY click, so re-picking
  // the active period re-applies it (and re-picking "custom" reopens the
  // date popup) instead of doing nothing.
  const handle_option_click = (value) => {
    setIsMenuOpen(false);
    if (value === "custom") {
      if (period !== "custom") period_before_custom_ref.current = period;
      onPeriodChange("custom");
      setIsCustomOpen(true);
      return;
    }
    if (value !== period) {
      onPeriodChange(value);
      return;
    }
    if (onApply) onApply();
  };

  // Leaving the date popup without picking a range means no range was ever
  // applied: no request was sent for it either, so the control has to stop
  // reading "Custom" over rows that are still under the previous window.
  const handle_custom_cancel = () => {
    setIsCustomOpen(false);
    if (period !== "custom" || from) return;
    // Nothing to go back to when the control was already sitting on an
    // unapplied "custom" (it mounted that way), so it takes the default.
    const previous = period_before_custom_ref.current;
    onPeriodChange(previous && previous !== "custom" ? previous : includeAll ? "all" : "this_year");
  };

  const option_label = (option) => (option.value === "custom" ? translate("DCS_STATS_PERIOD_CUSTOM") : translate(option.labelKey));
  const selected_option = options.find((option) => option.value === period);

  const get_selected_label = () => {
    if (period === "custom") {
      // One day picked twice reads as that one day.
      if (from && to && from === to) return format_date(from);
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
          style={plain ? { minWidth: 150 } : { fontFamily: FONT, height: FILTER_CONTROL_HEIGHT_PX, minHeight: FILTER_CONTROL_HEIGHT_PX, minWidth: 150, backgroundColor: "transparent", color: TEXT, borderColor: is_menu_open ? PRIMARY : BORDER, borderStyle: locked ? "dashed" : "solid" }}
        >
          <span className={plain ? "dcs-board-filter-value" : "truncate"}>{period === "custom" && from ? get_selected_label() : selected_option ? option_label(selected_option) : ""}</span>
          {!locked && (
            <svg width="10" height="6" viewBox="0 0 10 6" style={{ flexShrink: 0, transform: is_menu_open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms ease" }}>
              <path d="M1 1l4 4 4-4" fill="none" stroke="#9E9E9E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
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
              style={{ padding: "0.5rem 0.75rem", fontFamily: FONT, color: option.value === period ? PRIMARY : TEXT, fontWeight: option.value === period ? 700 : 400, background: "none", border: "none" }}
            >
              {option_label(option)}
            </button>
          ))}
        </MenuPopover>
      </div>

      <CustomDatePopup open={is_custom_open} onOpenChange={setIsCustomOpen} onCancel={handle_custom_cancel} from={from} to={to} onFromChange={onFromChange} onToChange={onToChange} onApply={onApply} translate={translate} />
    </div>
  );
}
