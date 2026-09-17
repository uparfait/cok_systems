import { with_alpha } from "../appearance.js";
import { anchor_of } from "./mapGeometry.js";

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
