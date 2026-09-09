import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { CHART_CATALOG, CHART_FAMILIES } from "../chartCatalog.js";
import { PRIMARY, series_color } from "../charts/chartTheme.js";

/**
 * A tiny hand-drawn glyph per chart type so the picker reads visually, not
 * just as a list of names. Every glyph is a 44x32 SVG using the palette.
 */
function ChartGlyph({ type }) {
  const c0 = series_color(0);
  const c1 = series_color(1);
  const c2 = series_color(2);
  const glyphs = {
    bar: (
      <g>
        <rect x="2" y="4" width="30" height="6" fill={c0} />
        <rect x="2" y="13" width="20" height="6" fill={c0} />
        <rect x="2" y="22" width="38" height="6" fill={c0} />
      </g>
    ),
    column: (
      <g>
        <rect x="4" y="14" width="8" height="16" fill={c0} />
        <rect x="17" y="6" width="8" height="24" fill={c0} />
        <rect x="30" y="18" width="8" height="12" fill={c0} />
      </g>
    ),
    grouped_column: (
      <g>
        <rect x="4" y="12" width="6" height="18" fill={c0} />
        <rect x="11" y="18" width="6" height="12" fill={c1} />
        <rect x="24" y="6" width="6" height="24" fill={c0} />
        <rect x="31" y="14" width="6" height="16" fill={c1} />
      </g>
    ),
    lollipop: (
      <g>
        <rect x="8" y="10" width="2" height="20" fill={c0} />
        <circle cx="9" cy="8" r="4" fill={c0} />
        <rect x="21" y="16" width="2" height="14" fill={c0} />
        <circle cx="22" cy="14" r="4" fill={c0} />
        <rect x="34" y="6" width="2" height="24" fill={c0} />
        <circle cx="35" cy="5" r="4" fill={c0} />
      </g>
    ),
    dot_plot: (
      <g>
        <circle cx="9" cy="10" r="4" fill={c0} />
        <circle cx="22" cy="20" r="4" fill={c0} />
        <circle cx="35" cy="8" r="4" fill={c0} />
      </g>
    ),
    line: <polyline points="2,26 12,14 22,20 32,6 42,12" fill="none" stroke={c0} strokeWidth="3" />,
    area: <polygon points="2,30 2,24 12,12 22,18 32,6 42,14 42,30" fill={c0} opacity="0.55" />,
    stacked_column: (
      <g>
        <rect x="6" y="16" width="9" height="14" fill={c0} />
        <rect x="6" y="8" width="9" height="8" fill={c1} />
        <rect x="26" y="12" width="9" height="18" fill={c0} />
        <rect x="26" y="4" width="9" height="8" fill={c1} />
      </g>
    ),
    stacked_100: (
      <g>
        <rect x="6" y="4" width="9" height="16" fill={c0} />
        <rect x="6" y="20" width="9" height="10" fill={c1} />
        <rect x="26" y="4" width="9" height="8" fill={c0} />
        <rect x="26" y="12" width="9" height="18" fill={c1} />
      </g>
    ),
    pie: (
      <g>
        <circle cx="21" cy="17" r="13" fill={c0} />
        <path d="M21 17 L21 4 A13 13 0 0 1 33.5 21 Z" fill={c1} />
      </g>
    ),
    donut: (
      <g>
        <circle cx="21" cy="17" r="13" fill={c0} />
        <path d="M21 17 L21 4 A13 13 0 0 1 33.5 21 Z" fill={c1} />
        <circle cx="21" cy="17" r="6" fill="#FFFFFF" />
      </g>
    ),
    waffle: (
      <g>
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2, 3, 4].map((col) => (
            <rect key={`${row}-${col}`} x={4 + col * 8} y={2 + row * 8} width="6" height="6" fill={row * 5 + col < 12 ? c0 : "#E0E0E0"} />
          )),
        )}
      </g>
    ),
    treemap: (
      <g>
        <rect x="2" y="2" width="22" height="28" fill={c0} />
        <rect x="26" y="2" width="16" height="16" fill={c1} />
        <rect x="26" y="20" width="16" height="10" fill={c2} />
      </g>
    ),
    scatter: (
      <g>
        {[
          [8, 22], [14, 12], [20, 18], [26, 8], [32, 14], [36, 24],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill={c0} />
        ))}
      </g>
    ),
    bubble: (
      <g>
        <circle cx="12" cy="20" r="6" fill={c0} opacity="0.8" />
        <circle cx="26" cy="10" r="4" fill={c0} opacity="0.8" />
        <circle cx="34" cy="22" r="8" fill={c0} opacity="0.6" />
      </g>
    ),
    heatmap: (
      <g>
        {[0, 1, 2].map((row) =>
          [0, 1, 2, 3].map((col) => (
            <rect key={`${row}-${col}`} x={2 + col * 10} y={2 + row * 10} width="9" height="9" fill={c0} opacity={0.2 + ((row * 4 + col) % 5) * 0.2} />
          )),
        )}
      </g>
    ),
    kpi: (
      <text x="22" y="24" textAnchor="middle" fontSize="20" fontWeight="700" fill={c0}>
        42
      </text>
    ),
  };
  return (
    <svg width="44" height="32" viewBox="0 0 44 32" aria-hidden="true">
      {glyphs[type] || glyphs.column}
    </svg>
  );
}

/**
 * Step one of the wizard: pick a chart type from the catalog, grouped by
 * family, each card carrying a glyph and a short "when to use" hint.
 */
export default function StepChartType({ selected, onSelect }) {
  const { translate } = useDcsLanguage();
  return (
    <div className="space-y-5">
      {CHART_FAMILIES.map((family) => (
        <div key={family.key}>
          <p className="text-xs font-semibold uppercase mb-2" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
            {translate(family.labelKey)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {CHART_CATALOG.filter((entry) => entry.family === family.key).map((entry) => {
              const is_selected = selected === entry.type;
              return (
                <button
                  key={entry.type}
                  type="button"
                  onClick={() => onSelect(entry.type)}
                  className="flex items-start gap-3 p-3 text-left border-2"
                  style={{
                    borderColor: is_selected ? PRIMARY : "#E0E0E0",
                    backgroundColor: is_selected ? "#F0F7FB" : "#FFFFFF",
                    cursor: "pointer",
                    transition: "border-color 160ms ease, background-color 160ms ease",
                  }}
                >
                  <span className="flex-shrink-0"><ChartGlyph type={entry.type} /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold" style={{ color: is_selected ? PRIMARY : "#333333", fontFamily: "'Montserrat', sans-serif" }}>
                      {translate(entry.labelKey)}
                    </span>
                    <span className="block text-xs mt-0.5" style={{ color: "#9E9E9E" }}>
                      {translate(entry.hintKey)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
