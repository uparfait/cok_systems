import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

// Shared with DcsTableSearchSort's search input and sort toggle, so every
// control across the whole filter bar lines up at exactly the same height.
export const FILTER_CONTROL_HEIGHT_PX = 40;

const PERIOD_OPTIONS = [
  { value: "all", labelKey: "DCS_STATS_PERIOD_ALL" },
  { value: "today", labelKey: "DCS_STATS_PERIOD_TODAY" },
  { value: "this_month", labelKey: "DCS_STATS_PERIOD_THIS_MONTH" },
  { value: "last_month", labelKey: "DCS_STATS_PERIOD_LAST_MONTH" },
  { value: "this_year", labelKey: "DCS_STATS_PERIOD_THIS_YEAR" },
  { value: "custom", labelKey: "DCS_STATS_PERIOD_CUSTOM" },
];

const CUSTOM_PRESETS = [
  { value: "today", labelKey: "DCS_STATS_PERIOD_TODAY" },
  { value: "this_month", labelKey: "DCS_STATS_PERIOD_THIS_MONTH" },
  { value: "last_month", labelKey: "DCS_STATS_PERIOD_LAST_MONTH" },
  { value: "this_year", labelKey: "DCS_STATS_PERIOD_THIS_YEAR" },
];

function format_date(date_string) {
  if (!date_string) return "";
  const date = new Date(date_string + "T00:00:00");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function get_period_label(period, from, to, translate) {
  if (period === "custom") {
    if (from && to) return `${format_date(from)} - ${format_date(to)}`;
    if (from) return `From ${format_date(from)}`;
    return translate("DCS_STATS_PERIOD_CUSTOM");
  }
  const option = PERIOD_OPTIONS.find((opt) => opt.value === period);
  return option ? translate(option.labelKey) : "";
}

function CustomDatePopup({ open, onOpenChange, from, to, onFromChange, onToChange, onApply, onSelectPreset, translate }) {
  const [local_from, setLocalFrom] = useState(from || "");
  const [local_to, setLocalTo] = useState(to || "");

  const handle_apply = () => {
    onFromChange(local_from);
    onToChange(local_to);
    onApply();
    onOpenChange(false);
  };

  const handle_preset = (preset_value) => {
    onSelectPreset(preset_value);
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
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-5 shadow-xl">
          <Dialog.Title className="text-sm font-semibold mb-3" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {translate("DCS_STATS_PERIOD_CUSTOM")}
          </Dialog.Title>

          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-2" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Quick presets
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CUSTOM_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => handle_preset(preset.value)}
                  className="px-2.5 py-1 text-xs rounded-full border border-gray-300 hover:bg-gray-50 hover:border-[#056daa] transition-colors"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  {translate(preset.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-3 mb-3">
            <p className="text-xs text-gray-500 mb-2" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Or pick a range
            </p>
            <div className="flex flex-col gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5" style={{ fontFamily: "'Montserrat', sans-serif" }}>From</label>
                <input
                  type="date"
                  value={local_from}
                  onChange={(event) => setLocalFrom(event.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  style={{ fontFamily: "'Montserrat', sans-serif", height: 36 }}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5" style={{ fontFamily: "'Montserrat', sans-serif" }}>To</label>
                <input
                  type="date"
                  value={local_to}
                  onChange={(event) => setLocalTo(event.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  style={{ fontFamily: "'Montserrat', sans-serif", height: 36 }}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {translate("DCS_BTN_CANCEL")}
            </button>
            <button
              type="button"
              onClick={handle_apply}
              disabled={!local_from}
              className="px-3 py-1.5 text-xs text-white bg-[#056daa] rounded hover:bg-[#045a8c] disabled:opacity-50 disabled:cursor-not-allowed"
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
 * Responsive date-range filter bar (chart and the submissions tables). Shows
 * a compact dropdown on narrow screens and a horizontal pill row on wider
 * ones. Tapping "custom" opens a popup with quick-preset chips and from/to
 * date pickers - the inline date inputs are gone, so the filter never breaks
 * its row layout or triggers horizontal scroll on mobile.
 *
 * allowWrap: the chart passes true so the pill row wraps naturally; the
 * tables pass false so their filter bar stays single-line and scrolls.
 */
export default function DcsPeriodFilter({ period, onPeriodChange, from, onFromChange, to, onToChange, onApply, includeAll, allowWrap }) {
  const { translate } = useDcsLanguage();
  const [is_custom_open, setIsCustomOpen] = useState(false);
  const options = includeAll ? PERIOD_OPTIONS : PERIOD_OPTIONS.filter((option) => option.value !== "all");

  const handle_period_select = (value) => {
    if (value === "custom") {
      setIsCustomOpen(true);
    } else {
      onPeriodChange(value);
    }
  };

  const handle_custom_preset = (preset_value) => {
    onPeriodChange(preset_value);
  };

  const is_active = (value) => {
    if (value === "custom") return period === "custom";
    return period === value;
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div
        className={`inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 ${allowWrap ? "flex-wrap" : ""}`}
        style={{ minHeight: FILTER_CONTROL_HEIGHT_PX }}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handle_period_select(option.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              is_active(option.value)
                ? "bg-[#056daa] text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {option.value === "custom"
              ? get_period_label("custom", from, to, translate)
              : translate(option.labelKey)}
          </button>
        ))}
      </div>

      <CustomDatePopup
        open={is_custom_open}
        onOpenChange={setIsCustom_open}
        from={from}
        to={to}
        onFromChange={onFromChange}
        onToChange={onToChange}
        onApply={onApply}
        onSelectPreset={handle_custom_preset}
        translate={translate}
      />
    </div>
  );
}
