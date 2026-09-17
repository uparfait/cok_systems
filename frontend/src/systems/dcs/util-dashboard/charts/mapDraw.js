import { with_alpha } from "../appearance.js";
import { anchor_of } from "./mapGeometry.js";
import { heat_ramp, spread_of } from "./heatScale.js";

/**
 * Everything a map widget hands to MapLibre: the basemap it sits on, the
 * GeoJSON it draws from and the layers that paint it.
 *
 * The layers are made ONCE, when the map loads, and never again: filtering a
 * board changes what the widget holds, not the map, so the sources are handed
 * new data and MapLibre redraws them in place. The map is never torn down and
 * rebuilt under the viewer, and the view they left it in stays theirs.
 *
 * The widget keeps no drawing code of its own. Boundaries are one GeoJSON
 * source painted by a fill layer whose color is read off each feature, the
 * parents above them are a second source drawn as outlines, and the places
 * themselves are a third source of points that feeds the optional heatmap.
 * Names and markers are not layers at all - they are HTML, pinned to the
 * map by the widget, so the icon component and the theme keep working and
 * nothing depends on the basemap's fonts.
 *
 * The basemap is a vector style fetched once; when it cannot be reached the
 * map falls back to a plain background in the widget's own color, and every
 * data layer still draws. Either way it is washed with the widget's own
 * background before anything of this widget is drawn over it, so a dark
 * board gets a dark map and the data keeps the contrast it was given.
 */

export const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/bright";
const STYLE_TIMEOUT = 8000;

const SOURCES = { land: "dcs-land", outline: "dcs-outline", point: "dcs-point" };
export const LAND_FILL = "dcs-land-fill";
const LAND_LINE = "dcs-land-line";
const LAND_ACTIVE = "dcs-land-active";
const OUTLINE_FILL = "dcs-outline-fill";
const OUTLINE_LINE = "dcs-outline-line";
const HEAT = "dcs-heat";
const HEAT_SOURCE = "dcs-heat-source";
const HEAT_LAYER = "dcs-heat-layer";
const HEAT_DOTS = "dcs-heat-dots";
const TINT = "dcs-map-tint";

// A place nobody answered is left pale; the properties are read off each
// feature, so the types are stated rather than guessed.
const ANSWERED_OPACITY = ["case", ["boolean", ["get", "answered"], false], 0.62, 0.12];
const EMPTY = { type: "FeatureCollection", features: [] };

export const blank_style = (background) => ({
  version: 8,
  sources: {},
  layers: [{ id: "dcs-map-background", type: "background", paint: { "background-color": background || "#F2F4F7" } }],
});

/** The basemap style, or a plain background when it cannot be fetched. */
export async function resolve_style(background) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STYLE_TIMEOUT);
    const response = await fetch(BASEMAP_STYLE, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) throw new Error("basemap");
    return await response.json();
  } catch (error) {
    return blank_style(background);
  }
}

const multipolygon = (shape) => ({ type: "MultiPolygon", coordinates: (shape.rings || []).map((ring) => [ring]) });

/** One feature per shape, carrying whatever the widget wants to paint by. */
export const shape_geojson = (shapes, describe) => ({
  type: "FeatureCollection",
  features: (shapes || [])
    .filter((shape) => (shape.rings || []).length > 0)
    .map((shape, index) => ({ type: "Feature", id: index, properties: describe(shape, index), geometry: multipolygon(shape) })),
});

/** One point per shape, where its name and its markers belong. */
export const point_geojson = (shapes, describe) => ({
  type: "FeatureCollection",
  features: (shapes || [])
    .map((shape, index) => ({ shape, index, point: anchor_of(shape) }))
    .filter((entry) => entry.point)
    .map((entry) => ({ type: "Feature", id: entry.index, properties: describe(entry.shape, entry.index), geometry: { type: "Point", coordinates: entry.point } })),
});

/**
 * A heat layer for one category: the places weigh it by that category's own
 * number, and the color it spreads is the category's own color, which is
 * whatever the widget's appearance says.
 */
const heat_paint = (entry) => ({
  "heatmap-weight": ["interpolate", ["linear"], ["get", entry.key], 0, 0, Math.max(1, entry.max), 1],
  "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 1, 16, 3],
  "heatmap-color": [
    "interpolate",
    ["linear"],
    ["heatmap-density"],
    0,
    with_alpha(entry.color, 0),
    0.2,
    with_alpha(entry.color, 0.25),
    0.5,
    with_alpha(entry.color, 0.5),
    0.8,
    with_alpha(entry.color, 0.75),
    1,
    entry.color,
  ],
  "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 16, 12, 34, 16, 70],
  "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.85, 15, 0.3],
});

/** The first label layer of the basemap: our own layers go under it. */
function first_symbol(map) {
  const layers = (map.getStyle() && map.getStyle().layers) || [];
  const found = layers.find((layer) => layer.type === "symbol");
  return found ? found.id : undefined;
}

/**
 * The layers this widget draws with, made once and then only ever handed
 * new data. They go under the basemap own labels, so street and place
 * names stay readable over them.
 */
export function create_layers(map, theme) {
  const before = first_symbol(map);
  // The basemap, washed with the widget's own background: this is what
  // makes the map follow the board's theme.
  if (!map.getLayer(TINT)) map.addLayer({ id: TINT, type: "background", paint: { "background-color": theme.background, "background-opacity": theme.tint } }, before);
  Object.values(SOURCES).forEach((id) => {
    if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: EMPTY });
  });
  const add = (spec) => {
    if (!map.getLayer(spec.id)) map.addLayer(spec, before);
  };
  add({ id: OUTLINE_FILL, type: "fill", source: SOURCES.outline, paint: { "fill-color": ["get", "color"], "fill-opacity": 0.06 } });
  add({
    id: LAND_FILL,
    type: "fill",
    source: SOURCES.land,
    paint: { "fill-color": ["get", "color"], "fill-opacity": ANSWERED_OPACITY, "fill-color-transition": { duration: 400 }, "fill-opacity-transition": { duration: 400 } },
  });
  add({ id: LAND_LINE, type: "line", source: SOURCES.land, paint: { "line-color": theme.line, "line-width": 0.8, "line-opacity": 0.8 } });
  add({ id: OUTLINE_LINE, type: "line", source: SOURCES.outline, paint: { "line-color": ["get", "color"], "line-width": ["number", ["get", "weight"], 1], "line-opacity": 0.85 } });
  // The place under the pointer, outlined once over everything else.
  add({ id: LAND_ACTIVE, type: "line", source: SOURCES.land, filter: ["==", ["get", "key"], " "], paint: { "line-color": theme.active, "line-width": 2.6 } });
}

/** New data for the same layers: this is what a filter changes. */
export function set_shapes(map, plan) {
  const feed = (id, data) => {
    const source = map.getSource(id);
    if (source) source.setData(data || EMPTY);
  };
  feed(SOURCES.outline, plan.outlines);
  feed(SOURCES.land, plan.land);
  feed(SOURCES.point, plan.points);
}

/** The colors that are not read off the features themselves. */
export function set_theme(map, theme) {
  if (map.getLayer(TINT)) {
    map.setPaintProperty(TINT, "background-color", theme.background);
    map.setPaintProperty(TINT, "background-opacity", theme.tint);
  }
  if (map.getLayer(LAND_LINE)) map.setPaintProperty(LAND_LINE, "line-color", theme.line);
  if (map.getLayer(LAND_ACTIVE)) map.setPaintProperty(LAND_ACTIVE, "line-color", theme.active);
}

/**
 * The heat layers, one per category: rebuilt only when the categories or
 * their colors change, and always under the outline that follows the
 * pointer.
 */
export function set_heat(map, entries) {
  ((map.getStyle() && map.getStyle().layers) || [])
    .filter((layer) => layer.id.indexOf(HEAT) === 0)
    .forEach((layer) => map.removeLayer(layer.id));
  (entries || []).forEach((entry, index) => {
    map.addLayer({ id: HEAT + "-" + index, type: "heatmap", source: SOURCES.point, maxzoom: 17, paint: heat_paint(entry) }, map.getLayer(LAND_ACTIVE) ? LAND_ACTIVE : undefined);
  });
}
/** Outlines the place under the pointer, or nothing at all. */
export function highlight(map, key) {
  if (map && map.getLayer(LAND_ACTIVE)) map.setFilter(LAND_ACTIVE, ["==", ["get", "key"], key || ""]);
}

/** The points of a heat map: one per record, where it was collected. */
export const heat_geojson = (points) => ({
  type: "FeatureCollection",
  features: (points || []).map((point, index) => ({
    type: "Feature",
    id: index,
    properties: { weight: Number(point.weight) || 0, group: point.group === null || point.group === undefined ? "" : String(point.group) },
    geometry: { type: "Point", coordinates: [Number(point.lng), Number(point.lat)] },
  })),
});

/**
 * A heat map, drawn the way heat maps are drawn: every record spreads heat
 * of its own weight, the spread grows with the zoom, and the burn fades out
 * as the viewer arrives - where the single points take over, each one drawn
 * as a dot so a dense place can still be read apart.
 *
 * Split into values, there is one layer per value, each in its own color,
 * so two values over the same ground are told apart by hue rather than
 * washed into one.
 */
export function set_heat_map(map, plan) {
  ((map.getStyle() && map.getStyle().layers) || [])
    .filter((layer) => layer.id.indexOf(HEAT_LAYER) === 0 || layer.id.indexOf(HEAT_DOTS) === 0)
    .forEach((layer) => map.removeLayer(layer.id));
  if (!map.getSource(HEAT_SOURCE)) map.addSource(HEAT_SOURCE, { type: "geojson", data: plan.points || EMPTY });
  else map.getSource(HEAT_SOURCE).setData(plan.points || EMPTY);

  const spread = { radius: Number(plan.radius) || spread_of().radius, intensity: Number(plan.intensity) || spread_of().intensity };
  const top = Math.max(1, Number(plan.high) || 1);
  const layers = plan.layers && plan.layers.length > 0 ? plan.layers : [{ key: "", low: plan.low, high: plan.hot }];
  layers.forEach((entry, index) => {
    const paint = {
      "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, top, 1],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 6, spread.intensity * 0.6, 16, spread.intensity * 2.2],
      "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"]].concat(heat_ramp(entry.low, entry.high)),
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 6, spread.radius * 0.5, 12, spread.radius, 18, spread.radius * 2.4],
      "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.95, 16, 0.75, 18, 0.35],
    };
    const spec = { id: HEAT_LAYER + "-" + index, type: "heatmap", source: HEAT_SOURCE, paint };
    if (entry.key) spec.filter = ["==", ["get", "group"], entry.key];
    map.addLayer(spec);
  });
  if (plan.dots === false) return;
  layers.forEach((entry, index) => {
    const spec = {
      id: HEAT_DOTS + "-" + index,
      type: "circle",
      source: HEAT_SOURCE,
      minzoom: 13,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 2.5, 18, 7],
        "circle-color": entry.high || plan.hot,
        "circle-stroke-color": "#FFFFFF",
        "circle-stroke-width": 0.8,
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 15, 0.85],
      },
    };
    if (entry.key) spec.filter = ["==", ["get", "group"], entry.key];
    map.addLayer(spec);
  });
}

/** Takes the heat off, for a map that has gone back to boundaries. */
export function clear_heat_map(map) {
  ((map.getStyle() && map.getStyle().layers) || [])
    .filter((layer) => layer.id.indexOf(HEAT_LAYER) === 0 || layer.id.indexOf(HEAT_DOTS) === 0)
    .forEach((layer) => map.removeLayer(layer.id));
  if (map.getSource(HEAT_SOURCE)) map.removeSource(HEAT_SOURCE);
}
