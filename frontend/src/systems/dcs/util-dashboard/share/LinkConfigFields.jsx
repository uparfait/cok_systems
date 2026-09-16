import React, { useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import FilterValueSelect from "../filters/FilterValueSelect.jsx";
import DcsPeriodFilter from "../../components/DcsPeriodFilter.jsx";
import { field_label_of, applied_filter_list } from "../boardFilters.js";

const PRIMARY = "#056daa";
const BORDER = "#E0E0E0";
const TEXT_DARK = "#333333";
const TEXT_MUTED = "#9E9E9E";
const FONT = { fontFamily: "'Montserrat', sans-serif" };

export const DEFAULT_LINK_CONFIG = { filter_mode: "free", locked_filters: [], locked_period: null, show_title: false };

const is_default = (config) => !config || (config.filter_mode !== "locked" && !config.show_title);

function Radio({ checked, label, onPick }) {
  return (
    <label className="inline-flex items-start gap-2 cursor-pointer text-xs" style={{ color: TEXT_DARK, ...FONT }}>
      <span className="flex items-center justify-center flex-shrink-0 mt-0.5" style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${checked ? PRIMARY : BORDER}` }} onClick={onPick}>
        {checked && <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: PRIMARY }} />}
      </span>
      <input type="radio" className="sr-only" checked={checked} onChange={onPick} />
      <span>{label}</span>
    </label>
  );
}

/**
 * A share link's advanced configuration: whether viewers filter the board
 * themselves or see it under filter values fixed here (one value per board
 * filter; the values offered follow the other fixed values, like on the
 * board itself), and whether the link's title replaces the dashboard's
 * name for viewers. Folded away until asked for.
 */
export default function LinkConfigFields({ config, onChange, filters, fields, fetchValues }) {
  const { translate } = useDcsLanguage();
  const current = config || DEFAULT_LINK_CONFIG;
  const [open, setOpen] = useState(!is_default(current));
  const defs = filters || [];
  const locked_map = Object.fromEntries((current.locked_filters || []).map((entry) => [entry.field_id, entry.value]));

  const set_mode = (filter_mode) => onChange({ ...current, filter_mode, locked_filters: filter_mode === "locked" ? current.locked_filters || [] : [], locked_period: filter_mode === "locked" ? current.locked_period || null : null });
  // The fixed period: a preset, or a custom range once its dates are applied.
  const period = current.locked_period || null;
  const set_period = (preset) => onChange({ ...current, locked_period: preset === "all" ? { preset: "all", from: null, to: null } : preset === "custom" ? { preset: "custom", from: period && period.from, to: period && period.to } : { preset, from: null, to: null } });
  const apply_custom = (from, to) => onChange({ ...current, locked_period: { preset: "custom", from: from || null, to: to || null } });
  const set_locked = (field_id, value) => {
    const next = { ...locked_map };
    if (value === "" || value === null || value === undefined) delete next[field_id];
    else next[field_id] = value;
    onChange({ ...current, locked_filters: applied_filter_list(next) });
  };

  return (
    <div className="border-t pt-3" style={{ borderColor: BORDER }}>
      <label className="flex items-center gap-2 text-sm cursor-pointer" style={FONT}>
        <input type="checkbox" checked={open} style={{ accentColor: PRIMARY }} onChange={(event) => setOpen(event.target.checked)} />
        {translate("DCS_DB_SHARE_ADVANCED")}
      </label>
      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="cok-auth-label">{translate("DCS_DB_SHARE_FILTER_MODE")}</p>
            <div className="flex flex-col gap-2 mt-1">
              <Radio checked={current.filter_mode !== "locked"} label={translate("DCS_DB_SHARE_FILTER_FREE")} onPick={() => set_mode("free")} />
              <Radio checked={current.filter_mode === "locked"} label={translate("DCS_DB_SHARE_FILTER_LOCKED")} onPick={() => set_mode("locked")} />
            </div>
          </div>
          {current.filter_mode === "locked" && (
            <div>
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={FONT}>
                <input type="checkbox" checked={!!period} style={{ accentColor: PRIMARY }} onChange={(event) => onChange({ ...current, locked_period: event.target.checked ? { preset: "this_year", from: null, to: null } : null })} />
                {translate("DCS_DB_SHARE_FIX_PERIOD")}
              </label>
              {period && (
                <div className="dcs-board-root mt-2">
                  <DcsPeriodFilter period={period.preset} onPeriodChange={set_period} from={period.from || ""} onFromChange={() => {}} to={period.to || ""} onToChange={() => {}} onApply={apply_custom} includeAll />
                </div>
              )}
            </div>
          )}
          {current.filter_mode === "locked" &&
            (defs.length === 0 ? (
              <p className="text-xs" style={{ color: TEXT_MUTED }}>
                {translate("DCS_DB_SHARE_NO_FILTERS")}
              </p>
            ) : (
              <div className="dcs-board-root flex flex-wrap items-center gap-2">
                {defs.map((def) => (
                  <FilterValueSelect
                    key={def.field_id}
                    label={field_label_of(fields, def.field_id)}
                    value={locked_map[def.field_id]}
                    onChange={(value) => set_locked(def.field_id, value)}
                    fetchValues={() => fetchValues(def.field_id, applied_filter_list(locked_map).filter((entry) => entry.field_id !== def.field_id))}
                  />
                ))}
              </div>
            ))}
          <label className="flex items-start gap-2 text-sm cursor-pointer" style={FONT}>
            <input type="checkbox" className="mt-0.5" checked={current.show_title === true} style={{ accentColor: PRIMARY }} onChange={(event) => onChange({ ...current, show_title: event.target.checked })} />
            <span>
              {translate("DCS_DB_SHARE_SHOW_TITLE")}
              <span className="block text-xs" style={{ color: TEXT_MUTED }}>
                {translate("DCS_DB_SHARE_SHOW_TITLE_HINT")}
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
