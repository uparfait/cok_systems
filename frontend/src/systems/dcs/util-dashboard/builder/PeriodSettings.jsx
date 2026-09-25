import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { ChipGrid, Switch, Problem, TEXT_DARK, TEXT_MUTED, HEADING_FONT } from "./builderUi.jsx";
import { PERIOD_PRESETS, PRESET_KEYS, default_period, period_problem } from "./widgetBehavior.js";

/**
 * A widget's own TIME WINDOW: one of the presets, or a custom range with
 * its two dates - and the lock. Unlocked, the window is what the widget
 * opens on and the board's date filter replaces it while viewing; locked,
 * the widget always reads this window and the board's date filter passes
 * it by, which is what a "so far this year" card on a board of monthly
 * charts needs.
 */
export default function PeriodSettings({ period, onChange, disabled }) {
  const { translate } = useDcsLanguage();
  const current = period || default_period();
  const set = (changes) => onChange(Object.assign({}, current, changes));
  const input = { fontFamily: "'Montserrat', sans-serif" };
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_PERIOD_HINT")}</p>
      <ChipGrid
        options={PERIOD_PRESETS.map((preset) => ({ id: preset, label: translate(PRESET_KEYS[preset]) }))}
        value={current.preset}
        onChange={(preset) => set({ preset, from: preset === "custom" ? current.from : null, to: preset === "custom" ? current.to : null })}
        disabled={disabled}
        columns="grid-cols-2 sm:grid-cols-4"
      />
      {current.preset === "custom" && (
        <div className="dcs-view-swap grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="flex items-center gap-2">
            <span className="text-xs w-12" style={{ color: TEXT_DARK, ...HEADING_FONT }}>{translate("DCS_DB_PERIOD_FROM")}</span>
            <input type="date" className="dcs-rename-input flex-1" style={input} value={current.from ? String(current.from).slice(0, 10) : ""} disabled={disabled} onChange={(event) => set({ from: event.target.value || null })} />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-xs w-12" style={{ color: TEXT_DARK, ...HEADING_FONT }}>{translate("DCS_DB_PERIOD_TO")}</span>
            <input type="date" className="dcs-rename-input flex-1" style={input} value={current.to ? String(current.to).slice(0, 10) : ""} disabled={disabled} onChange={(event) => set({ to: event.target.value || null })} />
          </label>
        </div>
      )}
      <Problem>{period_problem(current, translate)}</Problem>
      <Switch checked={current.locked === true} onChange={(locked) => set({ locked })} label={translate("DCS_DB_PERIOD_LOCK")} disabled={disabled} />
      {current.locked === true && (
        <p className="dcs-view-swap text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_PERIOD_LOCKED_HINT")}</p>
      )}
    </div>
  );
}
