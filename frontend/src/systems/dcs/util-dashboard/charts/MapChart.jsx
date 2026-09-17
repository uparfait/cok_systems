import React, { useEffect, useMemo, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useMapScope } from "../mapScope.jsx";
import { build_palette, spread_color, with_alpha } from "../appearance.js";
import { chart_density } from "./density.js";
import { bounds_of, anchor_of, map_bounds, map_key, grow_box } from "./mapGeometry.js";
import { create_layers, set_shapes, set_theme, set_heat, highlight, shape_geojson, point_geojson, heat_geojson, set_heat_map, clear_heat_map, LAND_FILL } from "./mapDraw.js";
import { HEAT_LOW, HEAT_HIGH } from "./heatScale.js";
import { take_cache, take_map, attach_map, start_map, release_map, drop_map } from "./mapKeeper.js";
import { usePlaceMarkers } from "./mapOverlay.jsx";
import { use_boundaries } from "./useBoundaries.js";
import { MapKindToggle, MapTools, MapTip, MapVeil, PlaceLabels } from "./MapChrome.jsx";
import MapLegend from "./MapLegend.jsx";
import { MARKER_SET } from "./mapMarkers.js";

// Roughly how wide one letter of a place name draws, per pixel of font size.
const LETTER_WIDTH = 0.58;
const LEVEL_ORDER = ["province", "district", "sector", "cell", "village"];
const chain_of = (shape) => (shape.path || []).concat(shape.name).join("/");

/** How light a color is, 0 to 1 - what tells a dark board from a light one. */
function lightness(color) {
  const hex = String(color || "").replace("#", "");
  if (hex.length < 6) return 1;
  const part = (at) => parseInt(hex.slice(at, at + 2), 16) / 255;
  return 0.2126 * part(0) + 0.7152 * part(2) + 0.0722 * part(4);
}

/** The box a scatter of points covers. */
function points_box(points) {
  let box = null;
  (points || []).forEach((point) => {
    const x = Number(point.lng);
    const y = Number(point.lat);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    box = grow_box(box, { min_x: x, min_y: y, max_x: x, max_y: y });
  });
  if (!box) return null;
  // A single point is a place, not a box: give it room to be seen in.
  if (box.max_x - box.min_x < 0.004) {
    box.min_x -= 0.002;
    box.max_x += 0.002;
  }
  if (box.max_y - box.min_y < 0.004) {
    box.min_y -= 0.002;
    box.max_y += 0.002;
  }
  return box;
}

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
  const [broken, setBroken] = useState(false);
  const [tip, setTip] = useState(null);
  const host_ref = useRef(null);
  const bounds_ref = useRef(null);
  const outer_ref = useRef(null);
  const id_ref = useRef(null);
  if (!id_ref.current) id_ref.current = mapKey || `map-${Math.random().toString(36).slice(2)}`;
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
  theme_ref.current = { line: with_alpha(colors.text, 0.45), active: colors.number, background: colors.background, tint: lightness(colors.background) < 0.5 ? 0.62 : 0.3 };

  // However a map engine fails - and some fail by never answering at all -
  // the card must end up with something a viewer can act on.
  useEffect(() => {
    if (ready || broken) return undefined;
    const timer = window.setTimeout(() => setBroken(true), 20000);
    return () => window.clearTimeout(timer);
  }, [ready, broken, attempt]);

  const names = useMemo(() => (is_heat ? [] : (rows || []).map((row) => row.label).filter(Boolean)), [rows, is_heat]);
  const names_key = names.join("|");
  const { status, version } = use_boundaries({ heat: is_heat, names, names_key, scope_key, attempt, cache, fetch_shapes, translate });

  const height = Math.max(220, size.height + 60);
  const number_text = (value) => Number(value).toLocaleString("en-US");

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
    return total === null ? [] : [{ key: shape.name, color: color_of(shape), count: total }];
  };

  const label_font = Math.max(8, size.font - 1);
  const mark_size = Math.max(12, Math.round(size.font * 1.3));
  const marker_icon = marker || MARKER_SET[0];
  const label_text = (shape) => {
    const value = value_of(shape);
    return showMarkers || value === null ? shape.name : `${shape.name} ${number_text(value)}`;
  };
  // Text sits over colored land, so it carries a halo of the widget's own
  // background - that is what keeps it readable in either theme.
  const halo = `0 0 3px ${colors.background}, 0 0 2px ${colors.background}, 0 0 1px ${colors.background}`;

  // What a world map draws right now: the boundaries of the names it holds,
  // taken from what has already been fetched, and the parents above them.
  const drawing = useMemo(() => {
    const shapes = [];
    const unknown = [];
    if (!is_heat) {
      (rows || []).forEach((row) => {
        const key = map_key(row.label);
        const entry = cache.places.get(key);
        if (entry) shapes.push(...entry.list);
        else if (cache.unknown.has(key)) unknown.push(row.label);
      });
    }
    const chains = new Set();
    shapes.forEach((shape) => (shape.path || []).forEach((step, depth) => chains.add(shape.path.slice(0, depth + 1).join("/"))));
    const outlines = Array.from(cache.parents.values()).filter((shape) => chains.has(chain_of(shape)));
    return { shapes, outlines, unknown };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, names_key, is_heat]);

  // The heat layers: one per value of the split field, each in its own
  // color, or one scale from the widget's own low color to its high one.
  const heat_plan = useMemo(() => {
    if (!is_heat) return null;
    const list = (groups || []).map((group, index) => ({ key: group.label, low: value_color(group.label, index), high: value_color(group.label, index) }));
    return {
      points: heat_geojson(points),
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
    attach_map(entry, host_ref.current);
    if (entry.failed) setBroken(true);
    else if (entry.loaded) setReady(true);
    else start_map(entry, colors.background, () => setReady(true), () => setBroken(true));
    return () => {
      setReady(false);
      live_ref.current = null;
      release_map(entry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // The boundary layers, and the pointer, whenever this card takes over.
  useEffect(() => {
    const map = map_of();
    if (!map || !ready || is_heat) return undefined;
    create_layers(map, theme_ref.current);
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
  }, [ready, is_heat]);

  // New data for those layers - no rebuilding, no remounting.
  useEffect(() => {
    const map = map_of();
    const entry = live_ref.current;
    if (!map || !entry || !ready) return;
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
      const depth_of = (shape) => Math.max(0, LEVEL_ORDER.indexOf(cache.level) - LEVEL_ORDER.indexOf(shape.level) - 1);
      set_shapes(map, {
        land: shape_geojson(drawing.shapes, (shape, index) => ({
          key: `${index}`,
          name: shape.name,
          asked: shape.asked || shape.name,
          path: (shape.path || []).join(" / "),
          color: color_of(shape),
          answered: value_of(shape) !== null,
        })),
        outlines: shape_geojson(drawing.outlines, (shape, index) => ({ color: colors.color_for(shape.name, index + 3), weight: Math.max(0.8, 2.2 - depth_of(shape) * 0.5) })),
        points: point_geojson(drawing.shapes, (shape) => {
          const row = values.get(key_of(shape));
          const props = { w_total: row ? Number(row.value) || 0 : 0 };
          split_values.forEach((value, index) => {
            props[`w${index}`] = row ? Number(row[value]) || 0 : 0;
          });
          return props;
        }),
      });
      // The view is framed on THE PLACES THIS WIDGET HIGHLIGHTS - never on
      // the parents outlined behind them. One village fills the map with
      // that village; three districts fill it with those three.
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
  }, [ready, signature]);

  // The card can be resized under the map - grown to fill the screen, or
  // shrunk back - which the map must be told, or it keeps drawing into the
  // box it had.
  useEffect(() => {
    const element = host_ref.current;
    if (!element || !ready) return undefined;
    const observer = new ResizeObserver(() => map_of() && map_of().resize());
    observer.observe(element);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Which places may write their name and plant their markers, and what
  // room each of them needs to do it inside its own boundary.
  const places = useMemo(() => {
    if (is_heat) return [];
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
        return { key: `${shape.name}-${index}`, point, box, needed, label, marks, font: label_font };
      })
      .filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing, signature, is_heat]);
  const shown = usePlaceMarkers(map_of(), ready, places);

  const zoom_by = (step) => {
    const map = map_of();
    if (map) map.easeTo({ zoom: map.getZoom() + step, duration: 260 });
    setTip(null);
  };
  const reset_view = () => {
    const map = map_of();
    const home = outer_ref.current || bounds_ref.current;
    if (map && home) map.fitBounds(home, { padding: 18, duration: 500 });
    setTip(null);
  };
  const tip_row = tip ? values.get(map_key(tip.asked || tip.name)) : null;
  const failed = broken || (!is_heat && !!status.error && drawing.shapes.length === 0);
  const waiting = !failed && (status.loading || !ready);

  // The legend. A world map names its places or the values they are split
  // into; a heat map names the values it spreads, or the two ends of its
  // own scale with the lightest and heaviest point on it.
  const legend_items = is_heat
    ? (groups || []).length > 0
      ? (groups || []).map((group, index) => ({ key: group.label, name: group.label, color: value_color(group.label, index), value: group.value }))
      : [
          { key: "heat-low", name: translate("DCS_DB_MAP_HEAT_LOW"), color: lowColor || HEAT_LOW, value: (range && range.low) || 0 },
          { key: "heat-high", name: translate("DCS_DB_MAP_HEAT_HIGH"), color: highColor || HEAT_HIGH, value: (range && range.high) || 0 },
        ]
    : has_split
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
      <div className="dcs-map-frame dcs-no-drill" style={{ height, borderColor: colors.border, backgroundColor: colors.background }} onClick={(event) => event.stopPropagation()}>
        {/* MapLibre's own stylesheet would take this element's height away
            from it, so its size is written where no stylesheet can reach. */}
        <div ref={host_ref} className="dcs-map-canvas" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        <PlaceLabels shown={shown} icon={marker_icon} size={mark_size} colors={colors} halo={halo} format={number_text} />
        <MapTools colors={colors} translate={translate} onZoom={zoom_by} onReset={reset_view} />
        <MapTip tip={tip} row={tip_row} colors={colors} split={split_values} colorOf={value_color} translate={translate} format={number_text} />
        {(failed || waiting) && (
          <MapVeil
            failed={failed}
            message={!broken && status.error ? status.error : ""}
            colors={colors}
            translate={translate}
            onRetry={() => {
              // A retry builds the map again from nothing: whatever stopped
              // it the first time is still in the one that failed.
              drop_map(id_ref.current);
              setBroken(false);
              setAttempt((current) => current + 1);
            }}
          />
        )}
      </div>

      <MapLegend items={legend_items} palette={colors} onPick={!is_heat && (onItemClick || onLegendClick) ? pick_legend : null} unknown={drawing.unknown} />
    </div>
  );
}
