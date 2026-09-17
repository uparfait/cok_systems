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
import { resolve_style, create_layers, set_shapes, set_theme, set_heat, highlight, shape_geojson, point_geojson, LAND_FILL } from "./mapDraw.js";
import { usePlaceMarkers } from "./mapOverlay.jsx";
import MapLegend from "./MapLegend.jsx";
import { MARKER_SET } from "./mapMarkers.js";

// Roughly how wide one letter of a place name draws, per pixel of font size.
const LETTER_WIDTH = 0.58;
const START_VIEW = { center: [30.06, -1.94], zoom: 9 };
const LEVEL_ORDER = ["province", "district", "sector", "cell", "village"];
const chain_of = (shape) => (shape.path || []).concat(shape.name).join("/");

/**
 * A real map, drawn by MapLibre GL: the administrative boundaries of the
 * places this widget has data for, filled each in a color of its own over a
 * vector basemap, with every parent above them outlined behind. A place
 * nobody answered is left pale.
 *
 * THE MAP IS BUILT ONCE AND KEPT. Filtering a board changes which places the
 * widget holds, not the map: the boundaries it has already been given are
 * remembered, only names it has never seen are asked for, and what is drawn
 * is handed to the layers as new data. Nothing is torn down, nothing is
 * fetched twice, and the view the viewer left the map in stays theirs unless
 * the data moves somewhere it cannot see.
 *
 * No level is ever asked for either. The server works out whether these
 * names are districts, sectors, cells or villages, walking down from the
 * places the board is filtered to, so a name belonging to several places
 * comes back once per real place with the chain above it - which is what the
 * tooltip shows to tell them apart.
 *
 * A map split by a field (status, gender) plants ONE MARKER PER VALUE on
 * every place: the same icon each time, in the value's own color and
 * carrying that value's own number, which is what the legend names. Names
 * and markers are HTML pinned to the map, drawn only where the place is big
 * enough to hold them, so nothing is ever written over a neighbour.
 *
 * Asked for it, the map also spreads a heat layer per value, weighted by
 * that value's numbers and colored with the value's own color - every one of
 * them configurable on the widget, like everything else it paints with.
 *
 * A click inside the map opens the records of the place it landed on, while
 * the whole widget's records stay behind a double click OUTSIDE the map.
 */
export default function MapChart({ rows, series, marker, showMarkers, showLabels, heatmap, palette, density, animate, onItemClick, onLegendClick }) {
  const { translate } = useDcsLanguage();
  const { fetch_shapes, scope_key } = useMapScope();
  const colors = palette || build_palette(null);
  const size = density || chart_density();
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [version, setVersion] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [broken, setBroken] = useState(false);
  const [tip, setTip] = useState(null);
  const canvas_ref = useRef(null);
  const map_ref = useRef(null);
  const bounds_ref = useRef(null);
  const heat_ref = useRef("");
  const first_fit = useRef(true);
  // Every boundary this widget has ever been given, by the name it was asked
  // for. This is what a filter no longer costs a request.
  const cache_ref = useRef({ level: "", places: new Map(), parents: new Map(), unknown: new Set() });
  // The map's own handlers are bound once, so what they call is kept where
  // they can always see the newest one.
  const pick_ref = useRef(onItemClick);
  pick_ref.current = onItemClick;

  const names = useMemo(() => (rows || []).map((row) => row.label).filter(Boolean), [rows]);
  const names_key = names.join("|");

  // Only the names the map has never seen are ever asked for; the answer
  // says whether what is already held still stands.
  useEffect(() => {
    if (!fetch_shapes) {
      setStatus({ loading: false, error: translate("DCS_DB_MAP_NO_SOURCE") });
      return undefined;
    }
    const cache = cache_ref.current;
    const missing = names.filter((name) => !cache.places.has(map_key(name)) && !cache.unknown.has(map_key(name)));
    if (missing.length === 0 && (cache.level || names.length === 0)) {
      setStatus({ loading: false, error: "" });
      return undefined;
    }
    let alive = true;
    setStatus({ loading: true, error: "" });
    Promise.resolve(fetch_shapes(names, { have: Array.from(cache.places.values()).map((entry) => entry.asked), have_level: cache.level }))
      .then((response) => {
        const answer = (response && response.data) || response || null;
        if (!alive) return;
        if (!answer) {
          setStatus({ loading: false, error: translate("DCS_DB_MAP_FAILED") });
          return;
        }
        // A different level is a different map: what was held no longer fits.
        if (answer.kept !== true) {
          cache.places.clear();
          cache.parents.clear();
          cache.unknown.clear();
        }
        cache.level = answer.level || cache.level;
        (answer.shapes || []).forEach((shape) => {
          const key = map_key(shape.asked || shape.name);
          if (!cache.places.has(key)) cache.places.set(key, { asked: shape.asked || shape.name, list: [] });
          cache.places.get(key).list.push(shape);
        });
        (answer.parents || []).forEach((entry) => entry.shapes.forEach((shape) => cache.parents.set(chain_of(shape), { ...shape, level: entry.level })));
        (answer.unknown || []).forEach((name) => cache.unknown.add(map_key(name)));
        setVersion((current) => current + 1);
        setStatus({ loading: false, error: "" });
      })
      .catch(() => alive && setStatus({ loading: false, error: translate("DCS_DB_MAP_FAILED") }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names_key, scope_key, attempt]);

  const height = Math.max(220, size.height + 60);

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

  // What this widget draws right now: the boundaries of the names it holds,
  // taken from what has already been fetched, and the parents above them.
  const drawing = useMemo(() => {
    const cache = cache_ref.current;
    const shapes = [];
    const unknown = [];
    (rows || []).forEach((row) => {
      const key = map_key(row.label);
      const entry = cache.places.get(key);
      if (entry) shapes.push(...entry.list);
      else if (cache.unknown.has(key)) unknown.push(row.label);
    });
    const chains = new Set();
    shapes.forEach((shape) => (shape.path || []).forEach((step, depth) => chains.add(shape.path.slice(0, depth + 1).join("/"))));
    const outlines = Array.from(cache.parents.values()).filter((shape) => chains.has(chain_of(shape)));
    return { shapes, outlines, unknown };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, names_key]);

  // Everything the painting depends on, in one string: the layers are only
  // handed new data when one of them really changed.
  const signature = [
    version,
    names_key,
    split_values.join("|"),
    (rows || []).map((row) => row.value).join(","),
    marker,
    showMarkers,
    showLabels,
    heatmap,
    colors.background,
    colors.text,
    colors.number,
  ].join("~");

  // The map itself, made once for the life of the widget.
  useEffect(() => {
    let map = null;
    let cancelled = false;
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
      map_ref.current = null;
      if (map) map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // The layers, and the pointer, once the map is up.
  useEffect(() => {
    const map = map_ref.current;
    if (!map || !ready) return undefined;
    create_layers(map, { line: with_alpha(colors.text, 0.45), active: colors.number });
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
  }, [ready]);

  // New data for those layers - no rebuilding, no remounting.
  useEffect(() => {
    const map = map_ref.current;
    if (!map || !ready) return;
    const depth_of = (shape) => Math.max(0, LEVEL_ORDER.indexOf(cache_ref.current.level) - LEVEL_ORDER.indexOf(shape.level) - 1);
    const parent_color = (shape, index) => colors.color_for(shape.name, index + 3);
    set_shapes(map, {
      land: shape_geojson(drawing.shapes, (shape, index) => ({
        key: `${index}`,
        name: shape.name,
        asked: shape.asked || shape.name,
        path: (shape.path || []).join(" / "),
        color: color_of(shape),
        answered: value_of(shape) !== null,
      })),
      outlines: shape_geojson(drawing.outlines, (shape, index) => ({ color: parent_color(shape, index), weight: Math.max(0.8, 2.2 - depth_of(shape) * 0.5) })),
      points: point_geojson(drawing.shapes, (shape) => {
        const row = values.get(key_of(shape));
        const props = { w_total: row ? Number(row.value) || 0 : 0 };
        split_values.forEach((value, index) => {
          props[`w${index}`] = row ? Number(row[value]) || 0 : 0;
        });
        return props;
      }),
    });
    set_theme(map, { line: with_alpha(colors.text, 0.45), active: colors.number });

    const max_of = (key) => (rows || []).reduce((top, row) => Math.max(top, Number(key ? row[key] : row.value) || 0), 0);
    const heat = !heatmap
      ? []
      : has_split
        ? split_values.map((value, index) => ({ key: `w${index}`, color: value_color(value), max: max_of(value) }))
        : [{ key: "w_total", color: colors.color_override("heatmap") || colors.color_for("heatmap", 0), max: max_of(null) }];
    const heat_key = JSON.stringify(heat);
    if (heat_key !== heat_ref.current) {
      set_heat(map, heat);
      heat_ref.current = heat_key;
    }

    // The view follows the data only when the data has gone somewhere it
    // cannot see; a viewer who zoomed in keeps what they were looking at.
    const box = bounds_of(drawing.shapes.concat(drawing.outlines));
    if (!box) return;
    bounds_ref.current = map_bounds(box);
    const seen = map.getBounds();
    const inside = seen.contains([box.min_x, box.min_y]) && seen.contains([box.max_x, box.max_y]);
    if (first_fit.current || !inside) {
      map.fitBounds(bounds_ref.current, { padding: 18, duration: first_fit.current || animate === false ? 0 : 600 });
      first_fit.current = false;
    }
    const room = [(box.max_x - box.min_x) * 0.35 + 0.02, (box.max_y - box.min_y) * 0.35 + 0.02];
    map.setMaxBounds(null);
    map.setMaxBounds([
      [box.min_x - room[0], box.min_y - room[1]],
      [box.max_x + room[0], box.max_y + room[1]],
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signature]);

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
    return drawing.shapes
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
  }, [drawing, signature]);
  const shown = usePlaceMarkers(map_ref.current, ready, places);

  const tool_style = { backgroundColor: colors.background, borderColor: colors.border, color: colors.text };
  const zoom_by = (step) => {
    const map = map_ref.current;
    if (map) map.easeTo({ zoom: map.getZoom() + step, duration: 260 });
    setTip(null);
  };
  const tip_row = tip ? values.get(map_key(tip.asked || tip.name)) : null;
  const veil = { backgroundColor: with_alpha(colors.background, 0.72) };
  const failed = broken || (!!status.error && drawing.shapes.length === 0);

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
        {/* MapLibre's own stylesheet would take this element's height away
            from it, so its size is written where no stylesheet can reach. */}
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

        {failed ? (
          <div className="dcs-map-veil" style={veil}>
            <p className="text-xs font-semibold" style={{ color: colors.text }}>
              {(!broken && status.error) || translate("DCS_DB_MAP_FAILED")}
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
        ) : (
          (status.loading || !ready) && (
            <div className="dcs-map-veil" style={veil}>
              <SpiralLoader />
            </div>
          )
        )}
      </div>

      <MapLegend items={legend_items} palette={colors} onPick={onItemClick || onLegendClick ? pick_legend : null} unknown={drawing.unknown} />
    </div>
  );
}
