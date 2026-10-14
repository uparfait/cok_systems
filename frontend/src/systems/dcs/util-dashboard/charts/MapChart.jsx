import React, { useEffect, useMemo, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useMapScope } from "../mapScope.jsx";
import { build_palette, spread_color, with_alpha } from "../appearance.js";
import { chart_density } from "./density.js";
import { bounds_of, map_bounds, map_key, grow_box, points_box, lightness, heat_totals } from "./mapGeometry.js";
import { build_places } from "./mapPlaces.js";
import { set_shapes, set_theme, set_heat, shape_geojson, point_geojson, heat_geojson, set_heat_map, clear_heat_map } from "./mapDraw.js";
import { HEAT_LOW, HEAT_HIGH } from "./heatScale.js";
import { take_cache, take_map, attach_map, start_map, release_map, drop_map, watch_basemap, retry_basemap, mark_fallback, is_fallback } from "./mapKeeper.js";
import { usePlaceMarkers } from "./mapOverlay.jsx";
import { use_boundaries } from "./useBoundaries.js";
import { use_map_pointer } from "./useMapPointer.js";
import { map_legend_items } from "./mapLegendItems.js";
import { MapKindToggle, MapTools, MapTip, MapVeil, MapBasemapNote, PlaceLabels } from "./MapChrome.jsx";
import MapLegend from "./MapLegend.jsx";
import MapSvg from "./MapSvg.jsx";
import { LegendFrame } from "./SeriesLegend.jsx";
import { MARKER_SET } from "./mapMarkers.js";

const LEVEL_ORDER = ["province", "district", "sector", "cell", "village"];
// How long the map engine may take to come up before the picture is drawn without it.
const ENGINE_TIMEOUT = 8000;
const chain_of = (shape) => (shape.path || []).concat(shape.name).join("/");

/**
 * A map widget, drawn by MapLibre GL over a vector basemap, one of two ways.
 *
 * A WORLD map paints administrative boundaries: the places this widget has
 * data for, each filled in a color of its own, with every parent outlined
 * behind and a place nobody answered left pale. Its boundaries are not part
 * of the widget's data - they are asked for by name, and the server works
 * out whether those names are districts, sectors, cells or villages by
 * walking down from the places the board is filtered to, so a name that
 * belongs to several places comes back once per real place with the chain
 * above it.
 *
 * A HEAT map paints the records themselves, each at the position it was
 * collected: no boundaries, no levels, no markers. It is only offered when
 * the form captures a position, because an administrative name says nothing
 * about where inside its area an answer came from.
 *
 * THE MAP IS BUILT ONCE AND KEPT - across a filter, and across the card
 * being lifted out of the board to fill the screen, which unmounts
 * everything inside it (see mapKeeper). What is drawn is handed to the
 * layers as new data; nothing is torn down and nothing is fetched twice.
 *
 * WHEN THE ENGINE OR ITS BASEMAP DOES NOT COME - no WebGL, a worker that
 * cannot be fetched, a tile server out of reach, or simply nothing within
 * eight seconds - the same picture is drawn in plain SVG (see MapSvg):
 * the same boundaries in the same colors, the same markers, names, tooltip
 * and clicks, under a note that the base map is unavailable. Whichever is
 * showing stays: a basemap that arrives later is not slid under the viewer.
 *
 * The view goes to what the widget highlights, whole and with room to
 * spare, whenever that changes - and stays where the viewer put it while it
 * does not. Nothing holds the viewer in: they may zoom out to the whole
 * world and pan anywhere, and "Reset" brings back everything the map holds.
 */
export default function MapChart({
  mapKey,
  mode,
  rows,
  series,
  points,
  groups,
  range,
  marker,
  showMarkers,
  showLabels,
  radius,
  intensity,
  lowColor,
  highColor,
  showPoints,
  canHeat,
  canWorld,
  onMode,
  palette,
  density,
  animate,
  onItemClick,
  onLegendClick,
}) {
  const { translate } = useDcsLanguage();
  const { fetch_shapes, scope_key } = useMapScope();
  const colors = palette || build_palette(null);
  const size = density || chart_density();
  const is_heat = mode === "heat";
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [tip, setTip] = useState(null);
  // How the basemap under the boundaries stands: coming, in, or not coming.
  const [basemap, setBasemap] = useState("ready");
  const host_ref = useRef(null);
  const svg_ref = useRef(null);
  const bounds_ref = useRef(null);
  const outer_ref = useRef(null);
  const id_ref = useRef(null);
  if (!id_ref.current) id_ref.current = mapKey || `map-${Math.random().toString(36).slice(2)}`;
  const [fallback, setFallback] = useState(() => is_fallback(id_ref.current));
  // The boundaries are shared by anything drawing this widget; the map
  // itself is lent to this card while it is on the page, and taken in the
  // effect below - never during a render, which React may throw away.
  const cache = useMemo(() => take_cache(id_ref.current), []);
  const live_ref = useRef(null);
  const map_of = () => (live_ref.current ? live_ref.current.map : null);
  // The map's own handlers are bound once, so what they call is kept where
  // they can always see the newest one.
  const pick_ref = useRef(onItemClick);
  pick_ref.current = onItemClick;
  // Everything the map paints with that is not read off a feature. A dark
  // board washes the basemap harder, so the widget's own colors keep their
  // contrast over it.
  const theme_ref = useRef(null);
  theme_ref.current = { line: with_alpha(colors.text, 0.45), active: colors.number, background: colors.background_solid, tint: lightness(colors.background_solid) < 0.5 ? 0.62 : 0.3 };
  const go_fallback = () => {
    mark_fallback(live_ref.current);
    setFallback(true);
  };

  useEffect(() => {
    if (ready || fallback) return undefined;
    const timer = window.setTimeout(go_fallback, ENGINE_TIMEOUT);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fallback, attempt]);

  const names = useMemo(() => (is_heat ? [] : (rows || []).map((row) => row.label).filter(Boolean)), [rows, is_heat]);
  const names_key = names.join("|");
  const { status, version } = use_boundaries({ heat: is_heat, names, names_key, scope_key, attempt, cache, fetch_shapes, translate });

  const height = Math.max(220, size.height + 60);
  const number_text = (value) => colors.number_text(value);

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

  const value_color = (value, index) => colors.color_override(value) || colors.color_for(value, index === undefined ? split_values.indexOf(value) : index);
  const key_of = (shape) => map_key(shape.asked || shape.name);
  // One color per place NAME, so the several villages that share a name
  // share its color and its legend entry.
  const name_index = new Map();
  (rows || []).forEach((row, index) => {
    if (!name_index.has(map_key(row.label))) name_index.set(map_key(row.label), index);
  });
  const color_of = (shape) => colors.color_override(shape.name) || spread_color(name_index.has(key_of(shape)) ? name_index.get(key_of(shape)) : 0);
  const value_of = (shape) => {
    if (is_heat) {
      const total = heat_values ? heat_values.get(shape) : null;
      return total ? total : null;
    }
    const row = values.get(key_of(shape));
    return row ? row.value : null;
  };
  const parts_of = (shape) => {
    const row = values.get(key_of(shape));
    if (!row || !has_split) return [];
    return split_values
      .map((value) => ({ value, count: Number(row[value]) || 0 }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);
  };
  const marks_of = (shape) => {
    const parts = parts_of(shape);
    if (parts.length > 0) return parts.map((part) => ({ key: part.value, color: value_color(part.value), count: part.count }));
    const total = value_of(shape);
    return total === null ? [] : [{ key: shape.name, color: is_heat ? highColor || HEAT_HIGH : color_of(shape), count: total }];
  };
  const describe_land = (shape, index) => ({
    key: `${index}`,
    name: shape.name,
    asked: shape.asked || shape.name,
    path: (shape.path || []).join(" / "),
    color: value_of(shape) === null ? colors.text : color_of(shape),
    answered: value_of(shape) !== null,
  });
  const depth_of = (shape) => Math.max(0, LEVEL_ORDER.indexOf(cache.level) - LEVEL_ORDER.indexOf(shape.level) - 1);
  const describe_outline = (shape, index) => ({ color: colors.color_for(shape.name, index + 3), weight: Math.max(0.8, 2.2 - depth_of(shape) * 0.5) });

  const label_font = Math.max(8, size.font - 1);
  // A marker is a badge big enough to carry its own number.
  const mark_size = Math.max(24, Math.round(size.font * 2.2));
  const marker_icon = marker || MARKER_SET[0];
  const label_text = (shape) => {
    const value = value_of(shape);
    return showMarkers || value === null ? shape.name : `${shape.name} ${number_text(value)}`;
  };
  // Text sits over colored land, so it carries a halo of the widget's own
  // background - that is what keeps it readable in either theme.
  const halo = `0 0 3px ${colors.background_solid}, 0 0 2px ${colors.background_solid}, 0 0 1px ${colors.background_solid}`;

  // What a world map draws right now: the boundaries of the names it holds,
  // taken from what has already been fetched, and the parents above them.
  const drawing = useMemo(() => {
    const shapes = [];
    const unknown = [];
    // A heat map writes its names and counts over the whole level the
    // board is looking at, which comes back as context when nothing is named.
    if (is_heat) (cache.context || new Map()).forEach((shape) => shapes.push(shape));
    else {
      (rows || []).forEach((row) => {
        const key = map_key(row.label);
        const entry = cache.places.get(key);
        if (entry) shapes.push(...entry.list);
        else if (cache.unknown.has(key)) unknown.push(row.label);
      });
      // The rest of the level behind them, pale: every place the board is
      // looking at is on the map, answered or not.
      const drawn = new Set(shapes.map(chain_of));
      (cache.context || new Map()).forEach((shape) => {
        if (!drawn.has(chain_of(shape))) shapes.push(shape);
      });
    }
    const chains = new Set();
    shapes.forEach((shape) => (shape.path || []).forEach((step, depth) => chains.add(shape.path.slice(0, depth + 1).join("/"))));
    const outlines = is_heat ? [] : Array.from(cache.parents.values()).filter((shape) => chains.has(chain_of(shape)));
    return { shapes, outlines, unknown };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, names_key, is_heat]);
  // What the heat weighs inside each place: the number written beside its name.
  const heat_values = useMemo(() => (is_heat ? heat_totals(drawing.shapes, points) : null), [is_heat, drawing, points]);

  // The heat layers: one per value of the split field, each in its own
  // color, or one scale from the widget's own low color to its high one.
  const heat_plan = useMemo(() => {
    if (!is_heat) return null;
    const list = (groups || []).map((group, index) => ({ key: group.label, low: value_color(group.label, index), high: value_color(group.label, index) }));
    return {
      points: heat_geojson(points),
      raw: points || [],
      layers: list,
      low: lowColor || HEAT_LOW,
      hot: highColor || HEAT_HIGH,
      high: (range && range.high) || 1,
      radius: radius,
      intensity: intensity,
      dots: showPoints !== false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_heat, points, groups, lowColor, highColor, range, radius, intensity, showPoints, colors.background]);

  // Everything the painting depends on, in one string: the layers are only
  // handed new data when one of them really changed.
  const signature = [
    mode,
    version,
    names_key,
    split_values.join("|"),
    (rows || []).map((row) => row.value).join(","),
    (points || []).length,
    (groups || []).map((group) => `${group.label}:${group.value}`).join(","),
    marker,
    showMarkers,
    showLabels,
    radius,
    intensity,
    lowColor,
    highColor,
    showPoints,
    colors.background,
    colors.text,
    colors.number,
  ].join("~");

  // The map itself: borrowed while this card is on the page, built the
  // first time any card asks for it.
  useEffect(() => {
    const entry = take_map(id_ref.current);
    live_ref.current = entry;
    // Only the entry this card holds may speak to it - a map dropped by a
    // retry can still come up later - and a map that comes up late is not
    // a broken one, whatever the watchdog said meanwhile.
    const mine = () => live_ref.current === entry;
    const up = () => mine() && setReady(true);
    const down = () => {
      if (!mine()) return;
      mark_fallback(entry);
      setFallback(true);
    };
    if (entry.fallback || entry.failed) down();
    else {
      attach_map(entry, host_ref.current);
      if (entry.loaded) up();
      else start_map(entry, colors.background_solid, up, down);
    }
    const unwatch = watch_basemap(entry, (state) => {
      if (!mine()) return;
      setBasemap(state);
      if (state === "missing") down();
    });
    return () => {
      unwatch();
      setReady(false);
      live_ref.current = null;
      release_map(entry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  use_map_pointer(fallback ? null : map_of(), ready, is_heat, theme_ref, pick_ref, setTip);

  // New data for those layers - no rebuilding, no remounting.
  useEffect(() => {
    const map = map_of();
    const entry = live_ref.current;
    if (!map || !entry || !ready || fallback) return;
    let box = null;
    if (is_heat) {
      // Heat and boundaries never share a map: whichever is not being drawn
      // is emptied rather than left underneath.
      set_shapes(map, {});
      set_heat(map, []);
      set_heat_map(map, heat_plan);
      box = points_box(points);
    } else {
      clear_heat_map(map);
      set_shapes(map, {
        land: shape_geojson(drawing.shapes, describe_land),
        outlines: shape_geojson(drawing.outlines, describe_outline),
        points: point_geojson(drawing.shapes, (shape) => {
          const row = values.get(key_of(shape));
          const props = { w_total: row ? Number(row.value) || 0 : 0 };
          split_values.forEach((value, index) => {
            props[`w${index}`] = row ? Number(row[value]) || 0 : 0;
          });
          return props;
        }),
      });
      // The view is framed on THE LEVEL THIS WIDGET DRAWS - its answered
      // places and the pale rest of the level around them - never on the
      // parents outlined behind. One cell's villages fill the map with that
      // cell; the three districts fill it with the city.
      box = bounds_of(drawing.shapes) || bounds_of(drawing.outlines);
    }
    set_theme(map, theme_ref.current);
    if (!box) return;
    bounds_ref.current = map_bounds(box);
    outer_ref.current = map_bounds(is_heat ? box : grow_box(cache.box, box));
    const highlighted = is_heat ? `heat:${(points || []).length}:${signature}` : [cache.level].concat(drawing.shapes.map((shape) => chain_of(shape))).join(",");
    if (highlighted !== entry.fitted) {
      const first = entry.fitted === null;
      entry.fitted = highlighted;
      map.fitBounds(bounds_ref.current, { padding: 18, duration: first || animate === false ? 0 : 600 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signature, fallback]);

  // The card can be resized under the map - grown to fill the screen, or
  // shrunk back - which the map must be told, or it keeps drawing into the
  // box it had.
  useEffect(() => {
    const element = host_ref.current;
    if (!element || !ready || fallback) return undefined;
    const observer = new ResizeObserver(() => map_of() && map_of().resize());
    observer.observe(element);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fallback]);

  // Which places may write their name and plant their markers, and what
  // room each of them needs to do it inside its own boundary.
  const places = useMemo(
    () => build_places(drawing.shapes, { marks_of: showMarkers ? marks_of : () => [], label_text: showLabels === false ? () => "" : label_text, font: label_font }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawing, signature, is_heat, heat_values],
  );
  const shown = usePlaceMarkers(fallback ? null : map_of(), ready, places);

  // A click on a marker takes the viewer to that place.
  const zoom_to = (place) => {
    setTip(null);
    if (fallback) {
      if (svg_ref.current) svg_ref.current.zoom_to(place);
      return;
    }
    const map = map_of();
    if (map && place && place.box) map.fitBounds(map_bounds(place.box), { padding: 40, duration: 500, maxZoom: 15 });
  };
  const zoom_by = (step) => {
    setTip(null);
    if (fallback) {
      if (svg_ref.current) svg_ref.current.zoom_by(step);
      return;
    }
    const map = map_of();
    if (map) map.easeTo({ zoom: map.getZoom() + step, duration: 260 });
  };
  const reset_view = () => {
    setTip(null);
    if (fallback) {
      if (svg_ref.current) svg_ref.current.reset();
      return;
    }
    const map = map_of();
    const home = outer_ref.current || bounds_ref.current;
    if (map && home) map.fitBounds(home, { padding: 18, duration: 500 });
  };
  const tip_row = tip ? values.get(map_key(tip.asked || tip.name)) : null;
  const failed = !is_heat && !!status.error && drawing.shapes.length === 0;
  const waiting = !failed && ((status.loading && !is_heat) || (!ready && !fallback));

  const legend_items = map_legend_items({ is_heat, groups, rows, split_values, value_color, colors, name_index, show_markers: showMarkers, marker_icon, low_color: lowColor, high_color: highColor, range, translate });
  const pick_legend = (item) => {
    if (is_heat) return;
    if (item.is_value) {
      if (onLegendClick) onLegendClick({ label: item.name });
    } else if (onItemClick) {
      onItemClick({ label: item.name });
    }
  };

  return (
    <div>
      <MapKindToggle mode={is_heat ? "heat" : "world"} canHeat={canHeat} canWorld={canWorld} colors={colors} translate={translate} onMode={onMode} />
      <LegendFrame
        position={colors.legend_position}
        density={size}
        legend={<MapLegend items={legend_items} palette={colors} onPick={!is_heat && (onItemClick || onLegendClick) ? pick_legend : null} unknown={drawing.unknown} />}
      >
      <div className="dcs-map-frame dcs-no-drill" style={{ height, borderColor: colors.border, backgroundColor: colors.background }} onClick={(event) => event.stopPropagation()}>
        {fallback ? (
          <MapSvg
            ref={svg_ref}
            shapes={drawing.shapes}
            outlines={drawing.outlines}
            describeLand={describe_land}
            describeOutline={describe_outline}
            signature={signature}
            places={places}
            heat={is_heat ? heat_plan : null}
            colors={colors}
            theme={theme_ref.current}
            icon={marker_icon}
            markSize={mark_size}
            format={number_text}
            onTip={setTip}
            onPick={onItemClick ? (item) => pick_ref.current && pick_ref.current(item) : null}
            onZoomPlace={zoom_to}
          />
        ) : (
          <div ref={host_ref} className="dcs-map-canvas" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        )}
        {!fallback && <PlaceLabels shown={shown} icon={marker_icon} size={mark_size} colors={colors} halo={halo} format={number_text} onZoom={zoom_to} />}
        <MapTools colors={colors} translate={translate} onZoom={zoom_by} onReset={reset_view} />
        {fallback && !failed && <MapBasemapNote state="fallback" colors={colors} translate={translate} />}
        {!fallback && basemap !== "ready" && !failed && <MapBasemapNote state={basemap} colors={colors} translate={translate} onRetry={() => retry_basemap(live_ref.current)} />}
        <MapTip tip={tip} row={tip_row} colors={colors} split={split_values} colorOf={value_color} translate={translate} format={number_text} />
        {(failed || waiting) && (
          <MapVeil
            failed={failed}
            message={status.error || ""}
            colors={colors}
            translate={translate}
            onRetry={() => {
              // A retry builds the map again from nothing: whatever stopped
              // it the first time is still in the one that failed.
              drop_map(live_ref.current ? live_ref.current.key : id_ref.current);
              setFallback(false);
              setAttempt((current) => current + 1);
            }}
          />
        )}
      </div>
      </LegendFrame>
    </div>
  );
}
