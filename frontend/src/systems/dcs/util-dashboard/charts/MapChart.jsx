import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Map as GlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useMapScope } from "../mapScope.jsx";
import { build_palette, spread_color, with_alpha } from "../appearance.js";
import { chart_density } from "./density.js";
import LibraryIcon from "../icons/LibraryIcon.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";
import { bounds_of, anchor_of, map_bounds, map_key } from "./mapGeometry.js";
import { resolve_style, draw_map, clear_map, highlight, shape_geojson, point_geojson, LAND_FILL } from "./mapDraw.js";
import { usePlaceMarkers } from "./mapOverlay.jsx";
import MapLegend from "./MapLegend.jsx";
import { MARKER_SET } from "./mapMarkers.js";

// Roughly how wide one letter of a place name draws, per pixel of font size.
const LETTER_WIDTH = 0.58;
const START_VIEW = { center: [30.06, -1.94], zoom: 9 };

/**
 * A real map, drawn by MapLibre GL: the administrative boundaries of the
 * places this widget has data for, filled each in a color of its own over a
 * vector basemap, with every parent above them outlined behind. A place
 * nobody answered is left pale.
 *
 * The boundaries are not part of the widget's data - they are asked for by
 * name (only the places actually answered), with a retry when that fails,
 * and the server finds each one by walking down the administrative tree, so
 * a name that belongs to several places comes back once per real place with
 * the chain above it, which the tooltip shows.
 *
 * A map split by a field (status, gender) plants ONE MARKER PER VALUE on
 * every place: the same icon each time, in the value's own color and
 * carrying that value's own number, which is what the legend names. Names
 * and markers are HTML pinned to the map, drawn only where the place is big
 * enough to hold them, so nothing is ever written over a neighbour.
 *
 * Asked for it, the map also spreads a heat layer per value, weighted by
 * that value's numbers and colored with the value's own color - every one
 * of them configurable on the widget, like everything else it paints with.
 *
 * Panning, zooming and the animations are MapLibre's own; the view cannot
 * leave the places drawn. A click inside the map opens the records of the
 * place it landed on, while the whole widget's records stay behind a double
 * click OUTSIDE the map area.
 */
export default function MapChart({ rows, series, marker, showMarkers, showLabels, heatmap, palette, density, animate, onItemClick, onLegendClick }) {
  const { translate } = useDcsLanguage();
  const { fetch_shapes, scope_key } = useMapScope();
  const colors = palette || build_palette(null);
  const size = density || chart_density();
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [broken, setBroken] = useState(false);
  const [tip, setTip] = useState(null);
  const canvas_ref = useRef(null);
  const map_ref = useRef(null);
  const drawn_ref = useRef(null);
  const bounds_ref = useRef(null);
  // The map's own handlers are bound once, so what they call is kept where
  // they can always see the newest one.
  const pick_ref = useRef(onItemClick);
  pick_ref.current = onItemClick;

  const names = useMemo(() => (rows || []).map((row) => row.label).filter(Boolean), [rows]);
  const names_key = names.join("|");

  useEffect(() => {
    if (!fetch_shapes) {
      setState({ loading: false, error: translate("DCS_DB_MAP_NO_SOURCE"), data: null });
      return undefined;
    }
    let is_mounted = true;
    setState((current) => ({ loading: true, error: "", data: current.data }));
    Promise.resolve(fetch_shapes(names))
      .then((response) => {
        const data = (response && response.data) || response || null;
        if (is_mounted) setState({ loading: false, error: data ? "" : translate("DCS_DB_MAP_FAILED"), data });
      })
      .catch(() => is_mounted && setState({ loading: false, error: translate("DCS_DB_MAP_FAILED"), data: null }));
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names_key, scope_key, attempt]);

  const height = Math.max(220, size.height + 60);
  const data = state.data;

  // What one place is worth: its own number, or - when the map is split
  // into values - the sum of them, which the split rows never carry.
  const split_values = Array.isArray(series) ? series : [];
  const has_split = split_values.length > 0;
  const values = useMemo(() => {
    const total_of = (row) => {
      if (row.value !== undefined && row.value !== null && Number.isFinite(Number(row.value))) return Number(row.value);
      return split_values.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
    };
    const map = new Map();
    (rows || []).forEach((row) => map.set(map_key(row.label), { ...row, value: total_of(row) }));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, split_values.join("|")]);

  const value_color = (value) => colors.color_override(value) || colors.color_for(value, split_values.indexOf(value));
  // A shape answers to the name the widget asked for, which is what its
  // rows are labelled with - the boundary's own spelling can differ.
  const key_of = (shape) => map_key(shape.asked || shape.name);
  // One color per place NAME, so the several villages that share a name
  // share its color and its legend entry.
  const name_index = new Map();
  (rows || []).forEach((row, index) => {
    if (!name_index.has(map_key(row.label))) name_index.set(map_key(row.label), index);
  });
  const color_of = (shape) => colors.color_override(shape.name) || spread_color(name_index.has(key_of(shape)) ? name_index.get(key_of(shape)) : 0);
  const value_of = (shape) => {
    const row = values.get(key_of(shape));
    return row ? row.value : null;
  };
  // What one place is worth in each value, largest first, zeroes dropped.
  const parts_of = (shape) => {
    const row = values.get(key_of(shape));
    if (!row || !has_split) return [];
    return split_values
      .map((value) => ({ value, count: Number(row[value]) || 0 }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);
  };
  // What one place plants: one mark per value it holds, or its own total.
  const marks_of = (shape) => {
    const parts = parts_of(shape);
    if (parts.length > 0) return parts.map((part) => ({ key: part.value, color: value_color(part.value), count: part.count }));
    const total = value_of(shape);
    return total === null ? [] : [{ key: shape.name, color: color_of(shape), count: total }];
  };

  const label_font = Math.max(8, size.font - 1);
  const mark_size = Math.max(12, Math.round(size.font * 1.3));
  const marker_icon = marker || MARKER_SET[0];
  const number_text = (value) => Number(value).toLocaleString("en-US");
  const label_text = (shape) => {
    const value = value_of(shape);
    return showMarkers || value === null ? shape.name : `${shape.name} ${number_text(value)}`;
  };
  // Text sits over colored land, so it carries a halo of the widget's own
  // background - that is what keeps it readable in either theme.
  const halo = `0 0 3px ${colors.background}, 0 0 2px ${colors.background}, 0 0 1px ${colors.background}`;

  // Everything the drawing depends on, in one string: the map is only
  // rebuilt when one of them really changed.
  const signature = [names_key, split_values.join("|"), (rows || []).map((row) => row.value).join(","), marker, showMarkers, showLabels, heatmap, colors.background, colors.text, colors.number].join("~");

  // The map itself, made once the frame is on the page (the widget shows a
  // loader until then). The basemap style is fetched first, so the map can
  // fall back to the widget background when it cannot be reached.
  const has_frame = !!data;
  useEffect(() => {
    let map = null;
    let cancelled = false;
    if (!has_frame) return undefined;
    resolve_style(colors.background)
      .then((style) => {
        if (cancelled || !canvas_ref.current) return;
        map = new GlMap({
          container: canvas_ref.current,
          style,
          center: START_VIEW.center,
          zoom: START_VIEW.zoom,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
        });
        map.touchZoomRotate.disableRotation();
        map_ref.current = map;
        map.on("load", () => {
          if (cancelled) return;
          // The card may have been given its size after the map was made.
          map.resize();
          setReady(true);
        });
      })
      // A map engine that cannot start (no WebGL, a blocked worker) must say
      // so with its retry, never leave an empty box behind.
      .catch(() => !cancelled && setBroken(true));
    return () => {
      cancelled = true;
      setReady(false);
      drawn_ref.current = null;
      map_ref.current = null;
      if (map) map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [has_frame, attempt]);

  // The data layers, redrawn whenever the widget's own data or colors move.
  useEffect(() => {
    const map = map_ref.current;
    if (!map || !ready || !data) return undefined;
    const shapes = data.shapes || [];
    const parents = data.parents || [];
    const parent_color = (name, index) => colors.color_for(name, index + 3);
    const max_of = (key) => (rows || []).reduce((top, row) => Math.max(top, Number(key ? row[key] : row.value) || 0), 0);
    const heat = !heatmap
      ? []
      : has_split
        ? split_values.map((value, index) => ({ key: `w${index}`, color: value_color(value), max: max_of(value) }))
        : [{ key: "w_total", color: colors.color_override("heatmap") || colors.color_for("heatmap", 0), max: max_of(null) }];

    clear_map(map, drawn_ref.current);
    drawn_ref.current = draw_map(map, {
      land: shape_geojson(shapes, (shape, index) => ({
        key: `${index}`,
        name: shape.name,
        asked: shape.asked || shape.name,
        path: (shape.path || []).join(" / "),
        color: color_of(shape),
        answered: value_of(shape) !== null,
      })),
      outlines: shape_geojson(
        parents.slice().reverse().reduce((all, entry, depth) => all.concat(entry.shapes.map((shape, index) => ({ ...shape, depth, index }))), []),
        (shape) => ({ color: parent_color(shape.name, shape.index + shape.depth), weight: Math.max(0.8, 2.2 - shape.depth * 0.5) }),
      ),
      points: point_geojson(shapes, (shape) => {
        const row = values.get(key_of(shape));
        const props = { w_total: row ? Number(row.value) || 0 : 0 };
        split_values.forEach((value, index) => {
          props[`w${index}`] = row ? Number(row[value]) || 0 : 0;
        });
        return props;
      }),
      heat,
      theme: { line: with_alpha(colors.text, 0.45), active: colors.number },
      animate: animate !== false,
    });

    // The view holds the places drawn and cannot be taken away from them.
    const box = bounds_of(parents.reduce((all, entry) => all.concat(entry.shapes), shapes.slice()));
    const fitted = map_bounds(box);
    if (fitted) {
      bounds_ref.current = fitted;
      map.setMaxBounds(null);
      map.fitBounds(fitted, { padding: 18, duration: animate === false ? 0 : 700 });
      const room = [(box.max_x - box.min_x) * 0.35 + 0.02, (box.max_y - box.min_y) * 0.35 + 0.02];
      map.setMaxBounds([
        [box.min_x - room[0], box.min_y - room[1]],
        [box.max_x + room[0], box.max_y + room[1]],
      ]);
    }

    const on_move = (event) => {
      const feature = (event.features || [])[0];
      if (!feature) return;
      const props = feature.properties || {};
      highlight(map, props.key);
      map.getCanvas().style.cursor = pick_ref.current ? "pointer" : "";
      setTip({ x: event.point.x, y: event.point.y, name: props.name, asked: props.asked, path: props.path });
    };
    const on_leave = () => {
      highlight(map, null);
      map.getCanvas().style.cursor = "";
      setTip(null);
    };
    const on_click = (event) => {
      const feature = (event.features || [])[0];
      if (feature && pick_ref.current) pick_ref.current({ label: feature.properties.asked });
    };
    map.on("mousemove", LAND_FILL, on_move);
    map.on("mouseleave", LAND_FILL, on_leave);
    map.on("click", LAND_FILL, on_click);
    return () => {
      map.off("mousemove", LAND_FILL, on_move);
      map.off("mouseleave", LAND_FILL, on_leave);
      map.off("click", LAND_FILL, on_click);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, data, signature]);

  // The card can be resized under the map, which must be told or it draws
  // into the box it had.
  useEffect(() => {
    const element = canvas_ref.current;
    if (!element || !ready) return undefined;
    const observer = new ResizeObserver(() => map_ref.current && map_ref.current.resize());
    observer.observe(element);
    return () => observer.disconnect();
  }, [ready]);

  // Which places may write their name and plant their markers, and what
  // room each of them needs to do it inside its own boundary.
  const places = useMemo(() => {
    if (!data) return [];
    return (data.shapes || [])
      .map((shape, index) => {
        const marks = showMarkers ? marks_of(shape) : [];
        const label = showLabels === false ? "" : label_text(shape);
        const box = bounds_of([shape]);
        const point = anchor_of(shape);
        if ((!label && marks.length === 0) || !box || !point) return null;
        const needed = [
          Math.max(label ? label.length * label_font * LETTER_WIDTH + 6 : 0, marks.length * (mark_size + 22)),
          (label ? label_font * 1.6 : 0) + (marks.length > 0 ? mark_size + 4 : 0),
        ];
        return { key: `${shape.name}-${index}`, point, box, needed, label, marks };
      })
      .filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, signature]);
  const shown = usePlaceMarkers(map_ref.current, ready, places);

  if (state.loading && !data) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <SpiralLoader />
      </div>
    );
  }
  if (!data || broken) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-center px-3" style={{ height }}>
        <p className="text-xs font-semibold" style={{ color: colors.text }}>
          {(!broken && state.error) || translate("DCS_DB_MAP_FAILED")}
        </p>
        <button
          type="button"
          className="dcs-map-retry"
          style={{ color: colors.number, borderColor: colors.border }}
          onClick={() => {
            setBroken(false);
            setAttempt((current) => current + 1);
          }}
        >
          {translate("DCS_DB_RETRY")}
        </button>
      </div>
    );
  }

  const tool_style = { backgroundColor: colors.background, borderColor: colors.border, color: colors.text };
  const zoom_by = (step) => {
    const map = map_ref.current;
    if (map) map.easeTo({ zoom: map.getZoom() + step, duration: 260 });
    setTip(null);
  };
  const tip_row = tip ? values.get(map_key(tip.asked || tip.name)) : null;

  // The legend: the split values and their totals, or the places themselves.
  const legend_items = has_split
    ? split_values.map((value) => ({
        key: value,
        name: value,
        color: value_color(value),
        icon: showMarkers ? marker_icon : null,
        is_value: true,
        value: (rows || []).reduce((sum, row) => sum + (Number(row[value]) || 0), 0),
      }))
    : (rows || []).map((row) => ({ key: row.label, name: row.label, color: colors.color_override(row.label) || spread_color(name_index.get(map_key(row.label)) || 0), value: row.value }));
  const pick_legend = (item) => {
    if (item.is_value) {
      if (onLegendClick) onLegendClick({ label: item.name });
    } else if (onItemClick) {
      onItemClick({ label: item.name });
    }
  };

  return (
    <div>
      <div className="dcs-map-frame dcs-no-drill" style={{ height, borderColor: colors.border, backgroundColor: colors.background }} onClick={(event) => event.stopPropagation()}>
        <div ref={canvas_ref} className="dcs-map-canvas" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

        {shown.map((place) =>
          createPortal(
            <React.Fragment key={place.key}>
              {place.marks.length > 0 && (
                <span className="dcs-map-marker">
                  {place.marks.map((mark) => (
                    <span key={mark.key} className="dcs-map-mark">
                      <LibraryIcon icon={marker_icon} size={mark_size} color={mark.color} />
                      <b style={{ color: colors.text, textShadow: halo }}>{number_text(mark.count)}</b>
                    </span>
                  ))}
                </span>
              )}
              {place.label && (
                <span className="dcs-map-label" style={{ color: colors.text, fontSize: label_font, textShadow: halo }}>
                  {place.label}
                </span>
              )}
            </React.Fragment>,
            place.element,
            place.key,
          ),
        )}

        <div className="dcs-map-tools">
          <button type="button" style={tool_style} title={translate("DCS_DB_MAP_ZOOM_IN")} onClick={() => zoom_by(1)}>
            +
          </button>
          <button type="button" style={tool_style} title={translate("DCS_DB_MAP_ZOOM_OUT")} onClick={() => zoom_by(-1)}>
            -
          </button>
          <button
            type="button"
            className="dcs-map-reset"
            style={tool_style}
            title={translate("DCS_DB_MAP_RESET")}
            onClick={() => {
              const map = map_ref.current;
              if (map && bounds_ref.current) map.fitBounds(bounds_ref.current, { padding: 18, duration: 500 });
              setTip(null);
            }}
          >
            {translate("DCS_DB_MAP_RESET")}
          </button>
        </div>

        {tip && (
          <div className="dcs-map-tip" style={{ left: tip.x + 14, top: tip.y + 14, backgroundColor: colors.tooltip.backgroundColor, color: colors.tooltip_text.color, borderColor: colors.border }}>
            <b>{tip.name}</b>
            {tip.path && <span className="dcs-map-tip-path">{tip.path}</span>}
            <span>{tip_row ? number_text(tip_row.value) : translate("DCS_DB_MAP_NO_VALUE")}</span>
            {has_split && tip_row && (
              <span className="dcs-map-tip-values">
                {split_values
                  .filter((value) => (Number(tip_row[value]) || 0) > 0)
                  .map((value) => (
                    <span key={value} className="dcs-map-tip-value">
                      <span className="dcs-map-legend-swatch" style={{ borderColor: value_color(value), backgroundColor: value_color(value) }} />
                      {value} {number_text(tip_row[value])}
                    </span>
                  ))}
              </span>
            )}
          </div>
        )}
      </div>

      <MapLegend items={legend_items} palette={colors} onPick={onItemClick || onLegendClick ? pick_legend : null} unknown={data.unknown || []} />
    </div>
  );
}
