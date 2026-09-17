import React from "react";
import { createPortal } from "react-dom";
import LibraryIcon from "../icons/LibraryIcon.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";
import { with_alpha } from "../appearance.js";

/**
 * Everything a map widget puts ON the map rather than in it: the kind it is
 * drawn as, the zoom tools, the tooltip that follows the pointer, the veil
 * that covers it while it loads or fails, and the names and markers pinned
 * to the places themselves.
 *
 * All of it takes its colors from the widget's own appearance, and the
 * tools are glass - the widget background thinned and blurred - so they
 * read over a city's streets as well as over a pale board.
 */

const TOOL_MARKS = {
  in: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  out: <line x1="5" y1="12" x2="19" y2="12" />,
  reset: (
    <>
      <polyline points="4 9 4 4 9 4" />
      <polyline points="15 4 20 4 20 9" />
      <polyline points="20 15 20 20 15 20" />
      <polyline points="9 20 4 20 4 15" />
    </>
  ),
};

const tool_icon = (name) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {TOOL_MARKS[name]}
  </svg>
);

/** Which way this map is drawn: boundaries, or heat. Only an editor sees it. */
export function MapKindToggle({ mode, canHeat, canWorld, colors, translate, onMode }) {
  if (!onMode || (!canHeat && !canWorld)) return null;
  const kinds = [
    { id: "world", label: translate("DCS_DB_MAP_KIND_WORLD"), allowed: canWorld },
    { id: "heat", label: translate("DCS_DB_MAP_KIND_HEAT"), allowed: canHeat },
  ].filter((kind) => kind.allowed || kind.id === mode);
  if (kinds.length < 2) return null;
  return (
    <div className="dcs-map-kinds" onClick={(event) => event.stopPropagation()}>
      {kinds.map((kind) => (
        <button
          key={kind.id}
          type="button"
          className={`dcs-map-kind ${mode === kind.id ? "is-on" : ""}`}
          style={{
            backgroundColor: mode === kind.id ? with_alpha(colors.number, 0.16) : "transparent",
            borderColor: with_alpha(colors.text, 0.18),
            color: mode === kind.id ? colors.number : colors.text,
          }}
          onClick={() => mode !== kind.id && onMode(kind.id)}
        >
          {kind.label}
        </button>
      ))}
    </div>
  );
}

export function MapTools({ colors, translate, onZoom, onReset }) {
  const style = { backgroundColor: with_alpha(colors.background, 0.55), borderColor: with_alpha(colors.text, 0.18), color: colors.text };
  return (
    <div className="dcs-map-tools">
      <button type="button" style={style} title={translate("DCS_DB_MAP_ZOOM_IN")} aria-label={translate("DCS_DB_MAP_ZOOM_IN")} onClick={() => onZoom(1)}>
        {tool_icon("in")}
      </button>
      <button type="button" style={style} title={translate("DCS_DB_MAP_ZOOM_OUT")} aria-label={translate("DCS_DB_MAP_ZOOM_OUT")} onClick={() => onZoom(-1)}>
        {tool_icon("out")}
      </button>
      <button type="button" style={style} title={translate("DCS_DB_MAP_RESET")} aria-label={translate("DCS_DB_MAP_RESET")} onClick={onReset}>
        {tool_icon("reset")}
      </button>
    </div>
  );
}

/** What the pointer is over: the place, the chain above it and its numbers. */
export function MapTip({ tip, row, colors, split, colorOf, translate, format }) {
  if (!tip) return null;
  return (
    <div className="dcs-map-tip" style={{ left: tip.x + 14, top: tip.y + 14, backgroundColor: colors.tooltip.backgroundColor, color: colors.tooltip_text.color, borderColor: colors.border }}>
      <b>{tip.name}</b>
      {tip.path && <span className="dcs-map-tip-path">{tip.path}</span>}
      <span>{row ? format(row.value) : translate("DCS_DB_MAP_NO_VALUE")}</span>
      {split.length > 0 && row && (
        <span className="dcs-map-tip-values">
          {split
            .filter((value) => (Number(row[value]) || 0) > 0)
            .map((value) => (
              <span key={value} className="dcs-map-tip-value">
                <span className="dcs-map-legend-swatch" style={{ borderColor: colorOf(value), backgroundColor: colorOf(value) }} />
                {value} {format(row[value])}
              </span>
            ))}
        </span>
      )}
    </div>
  );
}

/** The loader, or what went wrong and the way to try again. */
export function MapVeil({ failed, message, colors, translate, onRetry }) {
  const style = { backgroundColor: with_alpha(colors.background, 0.72) };
  if (!failed) {
    return (
      <div className="dcs-map-veil" style={style}>
        <SpiralLoader />
      </div>
    );
  }
  return (
    <div className="dcs-map-veil" style={style}>
      <p className="text-xs font-semibold" style={{ color: colors.text }}>
        {message || translate("DCS_DB_MAP_FAILED")}
      </p>
      <button type="button" className="dcs-map-retry" style={{ color: colors.number, borderColor: colors.border }} onClick={onRetry}>
        {translate("DCS_DB_RETRY")}
      </button>
    </div>
  );
}

/**
 * The names and markers themselves, rendered into the elements MapLibre
 * holds over each place (see mapOverlay) - React content on a real map.
 */
export function PlaceLabels({ shown, icon, size, colors, halo, format }) {
  return shown.map((place) =>
    createPortal(
      <React.Fragment key={place.key}>
        {place.marks.length > 0 && (
          <span className="dcs-map-marker">
            {place.marks.map((mark) => (
              <span key={mark.key} className="dcs-map-mark">
                <LibraryIcon icon={icon} size={size} color={mark.color} />
                <b style={{ color: colors.text, textShadow: halo }}>{format(mark.count)}</b>
              </span>
            ))}
          </span>
        )}
        {place.label && (
          <span className="dcs-map-label" style={{ color: colors.text, fontSize: place.font, textShadow: halo }}>
            {place.label}
          </span>
        )}
      </React.Fragment>,
      place.element,
      place.key,
    ),
  );
}
