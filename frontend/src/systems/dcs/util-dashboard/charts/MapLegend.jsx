import React, { useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { with_alpha } from "../appearance.js";
import { map_key } from "./mapGeometry.js";

const PREVIEW = 5;

/**
 * What a map's colors mean: the scale the filled places are shaded on
 * (light for the smallest number, full color for the largest), then every
 * parent boundary with the color it is outlined in - the districts behind a
 * map of cells, and the city behind those. Long lists open with the first
 * few and a "Show more" line, like every other chart's legend.
 *
 * Places the form holds answers for but the city has no boundary for are
 * named at the end, so nobody is left wondering where they went.
 */
export default function MapLegend({ shapes, parents, values, maxValue, palette, parentColor, onItemClick, unknown }) {
  const { translate } = useDcsLanguage();
  const [open, setOpen] = useState(false);
  const entries = (parents || []).flatMap((entry, level_index) => entry.shapes.map((shape, index) => ({ level: entry.level, name: shape.name, color: parentColor(shape.name, index + level_index) })));
  const shown = open ? entries : entries.slice(0, PREVIEW);
  const missing = (unknown || []).length;
  const drawn = (shapes || []).filter((shape) => values.has(map_key(shape.name))).length;

  return (
    <div className="dcs-map-legend">
      <div className="dcs-map-scale">
        <span style={{ color: palette.muted }}>0</span>
        <span className="dcs-map-scale-bar" style={{ background: `linear-gradient(90deg, ${with_alpha(palette.accent, 0.16)}, ${palette.accent})` }} />
        <span style={{ color: palette.number }}>{Number(maxValue || 0).toLocaleString("en-US")}</span>
        <span className="dcs-map-scale-note" style={{ color: palette.muted }}>
          {translate("DCS_DB_MAP_PLACES", { count: drawn })}
        </span>
      </div>
      <div className="dcs-map-legend-items">
        {shown.map((entry) => (
          <button
            key={`${entry.level}-${entry.name}`}
            type="button"
            className="dcs-map-legend-item"
            style={{ color: palette.text, cursor: onItemClick ? "pointer" : "default" }}
            onClick={onItemClick ? () => onItemClick({ label: entry.name }) : undefined}
          >
            <span className="dcs-map-legend-swatch" style={{ borderColor: entry.color, backgroundColor: with_alpha(entry.color, 0.18) }} />
            {entry.name}
          </button>
        ))}
        {entries.length > PREVIEW && (
          <button type="button" className="dcs-map-legend-more" style={{ color: palette.number }} onClick={() => setOpen(!open)}>
            {open ? translate("DCS_DB_SHOW_LESS") : translate("DCS_DB_SHOW_MORE", { count: entries.length - PREVIEW })}
          </button>
        )}
      </div>
      {missing > 0 && (
        <p className="dcs-map-missing" style={{ color: palette.muted }}>
          {translate("DCS_DB_MAP_UNKNOWN", { count: missing })}
        </p>
      )}
    </div>
  );
}
