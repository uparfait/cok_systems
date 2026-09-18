import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import LinkConfigFields, { DEFAULT_LINK_CONFIG } from "./LinkConfigFields.jsx";

const PRIMARY = "#056daa";
const BORDER = "#E0E0E0";
const TEXT_DARK = "#333333";
const TEXT_MUTED = "#9E9E9E";
const FONT = { fontFamily: "'Montserrat', sans-serif" };

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
 * Which dashboards a share link opens, and the viewing configuration of
 * each. With one dashboard on the form this is just the configuration of
 * that one. With several, the link's owner chooses: only this dashboard,
 * or this one together with others ticked from the list - viewers then
 * pick which to open. A dropdown names the dashboard whose settings
 * (filters, fixed period, records, title) are being configured; every
 * dashboard keeps its own. The board filters another dashboard carries
 * are fetched when it is first configured.
 */
export default function LinkDashboardsFields({ primary, dashboards, config, onConfigChange, extra, onExtraChange, filters, fields, fetchValues, recordFields, fetchDashboardFilters }) {
  const { translate } = useDcsLanguage();
  const others = (dashboards || []).filter((entry) => entry.id !== primary.id);
  const combined = extra.length > 0;
  const [mode, setMode] = useState(combined ? "combined" : "only");
  const [configuring, setConfiguring] = useState(primary.id);
  const [filters_by_dashboard, setFiltersByDashboard] = useState({});

  const configured_ids = [primary.id].concat(extra.map((entry) => entry.dashboard_id));
  useEffect(() => {
    if (!configured_ids.includes(configuring)) setConfiguring(primary.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured_ids.join("|")]);

  // Another dashboard's own board filters, fetched once.
  useEffect(() => {
    if (configuring === primary.id || filters_by_dashboard[configuring] || !fetchDashboardFilters) return undefined;
    let is_current = true;
    fetchDashboardFilters(configuring)
      .then((list) => is_current && setFiltersByDashboard((held) => Object.assign({}, held, { [configuring]: list || [] })))
      .catch(() => is_current && setFiltersByDashboard((held) => Object.assign({}, held, { [configuring]: [] })));
    return () => {
      is_current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configuring]);

  const pick_mode = (next) => {
    setMode(next);
    if (next === "only") {
      onExtraChange([]);
      setConfiguring(primary.id);
    }
  };
  const toggle_other = (dashboard_id) => {
    if (extra.some((entry) => entry.dashboard_id === dashboard_id)) onExtraChange(extra.filter((entry) => entry.dashboard_id !== dashboard_id));
    else onExtraChange(extra.concat([{ dashboard_id, config: DEFAULT_LINK_CONFIG }]));
  };
  const name_of = (dashboard_id) => ((dashboards || []).find((entry) => entry.id === dashboard_id) || {}).name || dashboard_id;

  const is_primary = configuring === primary.id;
  const current_config = is_primary ? config : (extra.find((entry) => entry.dashboard_id === configuring) || {}).config || DEFAULT_LINK_CONFIG;
  const set_current_config = (next) => {
    if (is_primary) onConfigChange(next);
    else onExtraChange(extra.map((entry) => (entry.dashboard_id === configuring ? Object.assign({}, entry, { config: next }) : entry)));
  };
  const current_filters = is_primary ? filters : filters_by_dashboard[configuring];

  if (others.length === 0) {
    return <LinkConfigFields config={config} onChange={onConfigChange} filters={filters} fields={fields} fetchValues={fetchValues} recordFields={recordFields} />;
  }

  return (
    <div className="space-y-3">
      <div className="border-t pt-3" style={{ borderColor: BORDER }}>
        <p className="cok-auth-label">{translate("DCS_DB_SHARE_SCOPE")}</p>
        <div className="flex flex-col gap-2 mt-1">
          <Radio checked={mode === "only"} label={translate("DCS_DB_SHARE_SCOPE_ONLY", { name: primary.name })} onPick={() => pick_mode("only")} />
          <Radio checked={mode === "combined"} label={translate("DCS_DB_SHARE_SCOPE_COMBINED")} onPick={() => pick_mode("combined")} />
        </div>
      </div>

      {mode === "combined" && (
        <div className="space-y-2">
          <p className="cok-auth-label">{translate("DCS_DB_SHARE_PICK_OTHERS")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {others.map((entry) => (
              <label key={entry.id} className="flex items-center gap-2 text-sm cursor-pointer p-2" style={{ border: `1px solid ${BORDER}`, backgroundColor: "#FFFFFF", ...FONT }}>
                <input type="checkbox" checked={extra.some((held) => held.dashboard_id === entry.id)} style={{ accentColor: PRIMARY }} onChange={() => toggle_other(entry.id)} />
                <span className="truncate" style={{ color: TEXT_DARK }}>
                  {entry.name}
                </span>
                <span className="text-[11px] ml-auto flex-shrink-0" style={{ color: TEXT_MUTED }}>
                  {translate("DCS_DB_SHARE_WIDGETS_COUNT", { count: entry.widgets_count || 0 })}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs" style={{ color: TEXT_MUTED }}>
            {translate("DCS_DB_SHARE_COMBINED_HINT")}
          </p>
        </div>
      )}

      {mode === "combined" && extra.length > 0 && (
        <div>
          <label className="cok-auth-label">{translate("DCS_DB_SHARE_CONFIGURE_FOR")}</label>
          <select className="cok-auth-input w-full py-2" value={configuring} onChange={(event) => setConfiguring(event.target.value)}>
            <option value={primary.id}>
              {primary.name} {translate("DCS_DB_SHARE_PRIMARY_TAG")}
            </option>
            {extra.map((entry) => (
              <option key={entry.dashboard_id} value={entry.dashboard_id}>
                {name_of(entry.dashboard_id)}
              </option>
            ))}
          </select>
        </div>
      )}

      {!is_primary && current_filters === undefined ? (
        <p className="text-xs" style={{ color: TEXT_MUTED }}>
          {translate("DCS_WAITING_GENERIC")}
        </p>
      ) : (
        <LinkConfigFields key={configuring} config={current_config} onChange={set_current_config} filters={current_filters || []} fields={fields} fetchValues={fetchValues} recordFields={recordFields} />
      )}
    </div>
  );
}
