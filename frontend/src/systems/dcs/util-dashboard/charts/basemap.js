import { BLANK_BACKGROUND } from "./mapDraw.js";

/**
 * The BASEMAP under a map widget: a vector style from OpenFreeMap, fetched
 * by the browser. It is the slow part of a map on a thin link - the style,
 * then its sprite, fonts and tiles - so the widget never waits for it: the
 * map starts on a plain ground, the boundaries draw at once, and the
 * basemap is slid underneath whenever it arrives.
 *
 * One fetch serves every map on the page. A style that came once is kept
 * in this browser (localStorage), so the next page starts on it at once
 * and only its tiles are still to come; the kept copy is refreshed behind.
 * A fetch that fails is tried again on a widening schedule, then left to
 * the viewer's own retry.
 */

export const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/bright";
const CACHE_KEY = "dcs_basemap_style_v1";
const FETCH_TIMEOUT = 45000;
const RETRY_DELAYS = [5000, 15000, 30000, 60000, 120000];
const OURS = /^dcs-/;

let shared = null;

const well_formed = (style) => !!style && style.version === 8 && !!style.sources && Array.isArray(style.layers);

function read_cache() {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    const style = raw ? JSON.parse(raw) : null;
    return well_formed(style) ? style : null;
  } catch (error) {
    return null;
  }
}

function write_cache(style) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(style));
  } catch (error) {
    // Full or blocked storage: the next page fetches again, nothing worse.
  }
}

async function fetch_basemap() {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await fetch(BASEMAP_STYLE, { signal: controller.signal });
    if (!response.ok) throw new Error(`basemap ${response.status}`);
    const style = await response.json();
    if (!well_formed(style)) throw new Error("basemap shape");
    write_cache(style);
    return style;
  } finally {
    window.clearTimeout(timer);
  }
}

/** The one fetch every map shares; a failed one is let go, so the next ask fetches again. */
function shared_fetch() {
  if (!shared) {
    shared = fetch_basemap().catch((error) => {
      shared = null;
      throw error;
    });
  }
  return shared;
}

/** The basemap this browser already holds, or null - with a refresh of it started behind. */
export function cached_basemap() {
  const cached = read_cache();
  if (cached) shared_fetch().catch(() => null);
  return cached;
}

/** The basemap style, fetched once for every map on the page. */
export const load_basemap = () => shared_fetch();

export const retries_left = (attempt) => attempt < RETRY_DELAYS.length;
export const retry_delay = (attempt) => RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];

/**
 * The basemap slid under the widget's layers: everything of the widget's
 * (sources and layers named dcs-...) is carried over with its data, its
 * layers placed under the basemap's first labels, and the plain ground it
 * started on is left behind.
 */
export function apply_basemap(map, style) {
  map.setStyle(style, {
    diff: false,
    transformStyle: (previous, next) => {
      const held = previous || { sources: {}, layers: [] };
      const sources = Object.assign({}, next.sources);
      Object.keys(held.sources || {}).forEach((id) => {
        if (OURS.test(id)) sources[id] = held.sources[id];
      });
      const ours = (held.layers || []).filter((layer) => OURS.test(layer.id) && layer.id !== BLANK_BACKGROUND);
      const layers = (next.layers || []).slice();
      const at = layers.findIndex((layer) => layer.type === "symbol");
      const insert = at < 0 ? layers.length : at;
      return Object.assign({}, next, { sources, layers: layers.slice(0, insert).concat(ours, layers.slice(insert)) });
    },
  });
}
