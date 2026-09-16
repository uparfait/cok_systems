import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useMapScope } from "../mapScope.jsx";
import { build_palette, with_alpha } from "../appearance.js";
import { chart_density } from "./density.js";
import LibraryIcon from "../icons/LibraryIcon.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";
import { bounds_of, make_projection, anchor_of, shape_width, map_key } from "./mapGeometry.js";
import MapLegend from "./MapLegend.jsx";
import { MARKER_SET } from "./mapMarkers.js";

const MIN_ZOOM = 1;
const MAX_ZOOM = 14;
// A name is only written on a shape wide enough to hold it.
const LABEL_FROM_PX = 34;

/**
 * The City of Kigali, drawn from its own administrative boundaries and
 * zoomed to it: one filled shape per place the widget has data for (the
 * darker the shape, the larger its number), with every parent above them
 * outlined in its own color.
 *
 * The outlines are not part of the widget's data - they are asked for by
 * name (only the places actually answered), with a retry when that fails.
 * The map pans by dragging, zooms with the wheel or its own buttons, and
 * writes every name and marker in plain HTML above the drawing so they stay
 * readable at any zoom.
 */
export default function MapChart({ rows, series, level, marker, showMarkers, showLabels, palette, density, animate, onItemClick, onLegendClick }) {
  const { translate } = useDcsLanguage();
  const { fetch_shapes } = useMapScope();
  const colors = palette || build_palette(null);
  const size = density || chart_density();
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState({ k: 1, x: 0, y: 0, smooth: true });
  const [hover, setHover] = useState(null);
  const drag_ref = useRef(null);
  const frame_ref = useRef(null);

  const names = useMemo(() => (rows || []).map((row) => row.label).filter(Boolean), [rows]);
  const names_key = names.join("|");

  useEffect(() => {
    if (!fetch_shapes) {
      setState({ loading: false, error: translate("DCS_DB_MAP_NO_SOURCE"), data: null });
      return undefined;
    }
    let is_mounted = true;
    setState((current) => ({ loading: true, error: "", data: current.data }));
    Promise.resolve(fetch_shapes(level, names))
      .then((response) => {
        const data = (response && response.data) || response || null;
        if (is_mounted) setState({ loading: false, error: data ? "" : translate("DCS_DB_MAP_FAILED"), data });
      })
      .catch(() => is_mounted && setState({ loading: false, error: translate("DCS_DB_MAP_FAILED"), data: null }));
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, names_key, attempt]);

  const height = Math.max(220, size.height + 60);
  const width = Math.max(240, size.width - 8);
  const data = state.data;

  // The whole city always fits the box, whatever the widget itself covers,
  // so two maps of the same board line up.
  const projection = useMemo(() => {
    const frame = data ? (data.parents || []).reduce((best, entry) => best.concat(entry.shapes), (data.shapes || []).slice()) : [];
    return make_projection(bounds_of(frame), width, height, 10);
  }, [data, width, height]);

  const values = useMemo(() => {
    const map = new Map();
    (rows || []).forEach((row) => map.set(map_key(row.label), row));
    return map;
  }, [rows]);
  const max_value = (rows || []).reduce((best, row) => Math.max(best, Number(row.value) || 0), 0);

  const shade = (value) => {
    if (!max_value || !(value > 0)) return colors.empty;
    return with_alpha(colors.accent, Math.max(0.16, Math.min(1, value / max_value)));
  };

  const move = (next) => setView((current) => ({ ...current, ...next }));
  const zoom_by = (factor) =>
    setView((current) => {
      const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.k * factor));
      return { ...current, k, smooth: true };
    });

  // React attaches wheel listeners passively, so the map registers its own
  // and keeps the page from scrolling while the pointer zooms the city.
  useEffect(() => {
    const frame = frame_ref.current;
    if (!frame) return undefined;
    const on_wheel = (event) => {
      event.preventDefault();
      const box = frame.getBoundingClientRect();
      const px = event.clientX - box.left;
      const py = event.clientY - box.top;
      setView((current) => {
        const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.k * (event.deltaY < 0 ? 1.15 : 1 / 1.15)));
        const ratio = k / current.k;
        // Keep whatever sits under the pointer exactly where it is.
        return { k, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio, smooth: false };
      });
    };
    frame.addEventListener("wheel", on_wheel, { passive: false });
    return () => frame.removeEventListener("wheel", on_wheel);
  }, [state.loading, state.error]);

  const on_down = (event) => {
    drag_ref.current = { x: event.clientX - view.x, y: event.clientY - view.y, moved: false };
  };
  const on_move = (event) => {
    if (!drag_ref.current) return;
    drag_ref.current.moved = true;
    move({ x: event.clientX - drag_ref.current.x, y: event.clientY - drag_ref.current.y, smooth: false });
  };
  const on_up = () => {
    drag_ref.current = null;
  };

  if (state.loading && !data) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <SpiralLoader />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-center px-3" style={{ height }}>
        <p className="text-xs font-semibold" style={{ color: colors.text }}>
          {state.error || translate("DCS_DB_MAP_FAILED")}
        </p>
        <button type="button" className="dcs-map-retry" style={{ color: colors.number, borderColor: colors.border }} onClick={() => setAttempt((current) => current + 1)}>
          {translate("DCS_DB_RETRY")}
        </button>
      </div>
    );
  }

  const parents = data.parents || [];
  const parent_color = (name, index) => colors.color_for(name, index + 3);
  const transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`;
  const screen = (point) => {
    const [px, py] = projection.point(point);
    return [px * view.k + view.x, py * view.k + view.y];
  };

  // Names and markers ride above the drawing, at a fixed size, so zooming
  // in never blows a place name up into the next district.
  const labels = showLabels === false ? [] : (data.shapes || []).filter((shape) => shape_width(shape, projection) * view.k >= LABEL_FROM_PX);
  const markers = showMarkers ? data.shapes || [] : [];
  const marker_of = (shape) => {
    const row = values.get(map_key(shape.name));
    if (!row || !Array.isArray(series) || series.length === 0) return marker;
    // With a split, a shape carries the marker of its strongest value.
    const best = series.reduce((top, key) => ((row[key] || 0) > (row[top] || 0) ? key : top), series[0]);
    return MARKER_SET[series.indexOf(best) % MARKER_SET.length];
  };

  return (
    <div>
      <div
        ref={frame_ref}
        className="dcs-map-frame"
        style={{ height, borderColor: colors.border }}
        onMouseDown={on_down}
        onMouseMove={on_move}
        onMouseUp={on_up}
        onMouseLeave={() => {
          on_up();
          setHover(null);
        }}
      >
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="dcs-map-svg" style={{ transform, transition: view.smooth ? "transform 260ms ease" : "none" }}>
          {parents
            .slice()
            .reverse()
            .map((entry, level_index) =>
              entry.shapes.map((shape, index) => (
                <path
                  key={`${entry.level}-${shape.name}`}
                  d={projection.path(shape.rings)}
                  fill={with_alpha(parent_color(shape.name, index + level_index), 0.06)}
                  stroke={parent_color(shape.name, index + level_index)}
                  strokeWidth={(2.2 - level_index * 0.5) / view.k}
                  strokeLinejoin="round"
                />
              )),
            )}
          {(data.shapes || []).map((shape, index) => {
            const row = values.get(map_key(shape.name));
            const active = hover === shape.name;
            return (
              <path
                key={shape.name}
                d={projection.path(shape.rings)}
                fill={shade(row ? row.value : 0)}
                stroke={active ? colors.number : with_alpha(colors.text, 0.35)}
                strokeWidth={(active ? 2.4 : 0.8) / view.k}
                className={animate === false ? undefined : "dcs-map-shape"}
                style={{ animationDelay: `${Math.min(index * 12, 600)}ms`, cursor: onItemClick ? "pointer" : "default" }}
                onMouseEnter={() => setHover(shape.name)}
                onClick={() => {
                  if (drag_ref.current && drag_ref.current.moved) return;
                  if (onItemClick) onItemClick({ label: shape.name });
                }}
              />
            );
          })}
        </svg>

        <div className="dcs-map-overlay">
          {labels.map((shape) => {
            const point = anchor_of(shape);
            if (!point) return null;
            const [px, py] = screen(point);
            const row = values.get(map_key(shape.name));
            return (
              <span key={shape.name} className="dcs-map-label" style={{ left: px, top: py, color: colors.text, fontSize: Math.max(9, size.font) }}>
                {shape.name}
                {row ? <b style={{ color: colors.number }}>{row.value}</b> : null}
              </span>
            );
          })}
          {markers.map((shape) => {
            const point = anchor_of(shape);
            if (!point) return null;
            const [px, py] = screen(point);
            return (
              <span key={`marker-${shape.name}`} className="dcs-map-marker" style={{ left: px, top: py }}>
                <LibraryIcon icon={marker_of(shape)} size={Math.max(14, Math.round(size.font * 1.6))} color={colors.number} />
              </span>
            );
          })}
        </div>

        <div className="dcs-map-tools">
          <button type="button" title={translate("DCS_DB_MAP_ZOOM_IN")} onClick={() => zoom_by(1.4)}>
            +
          </button>
          <button type="button" title={translate("DCS_DB_MAP_ZOOM_OUT")} onClick={() => zoom_by(1 / 1.4)}>
            -
          </button>
          <button type="button" className="dcs-map-reset" title={translate("DCS_DB_MAP_RESET")} onClick={() => setView({ k: 1, x: 0, y: 0, smooth: true })}>
            {translate("DCS_DB_MAP_RESET")}
          </button>
        </div>

        {hover && (
          <div className="dcs-map-tip" style={{ backgroundColor: colors.tooltip.backgroundColor, color: colors.tooltip_text.color, borderColor: colors.border }}>
            <b>{hover}</b>
            <span>{values.has(map_key(hover)) ? values.get(map_key(hover)).value : translate("DCS_DB_MAP_NO_VALUE")}</span>
          </div>
        )}
      </div>

      <MapLegend shapes={data.shapes || []} parents={parents} values={values} maxValue={max_value} palette={colors} parentColor={parent_color} onItemClick={onLegendClick} unknown={data.unknown || []} />
    </div>
  );
}
