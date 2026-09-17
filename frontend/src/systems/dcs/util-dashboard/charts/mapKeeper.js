import { Map as GlMap } from "maplibre-gl";
import { resolve_style } from "./mapDraw.js";

/**
 * What a map widget keeps between mounts: the boundaries it has been given,
 * and the MapLibre map itself.
 *
 * A card grown to fill the screen is lifted out of the board and rendered
 * somewhere else entirely, which unmounts and remounts everything inside
 * it. A map must not notice: rebuilding it would throw away its outlines,
 * its camera and its WebGL context and fetch it all again, when all that
 * changed is how big the box is.
 *
 * Two things are kept, and they are kept differently. The BOUNDARIES are
 * plain data, shared by anything drawing that widget. The MAP is a single
 * element that can only be in one place at a time, so it is lent to ONE
 * card: a second card showing the same widget at the same time (a frozen
 * copy beside the live board) is given a map of its own rather than
 * stealing the element out of the first one and leaving it blank.
 *
 * A borrowed map is given back when its card goes. The shared one waits a
 * minute to be taken again - a remount is instant, and a widget that was
 * really removed is then destroyed; a private one is destroyed at once.
 */

const CACHES = new Map();
const MAPS = new Map();
// How long a map waits to be taken back before it is really let go.
const EVICT_MS = 60000;
let private_seq = 0;

/** Every boundary a widget has been given, by the name it was asked for. */
export function take_cache(key) {
  if (!CACHES.has(key)) CACHES.set(key, { level: "", places: new Map(), parents: new Map(), unknown: new Set(), box: null });
  return CACHES.get(key);
}

function new_entry(key) {
  const container = document.createElement("div");
  // MapLibre's own stylesheet sets position: relative on its container,
  // which would take the frame's height away from it, so the size is
  // written on the element itself where no stylesheet can reach.
  container.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  const entry = { key, container, map: null, loaded: false, failed: false, starting: false, waiters: [], held: false, heat: "", fitted: null, timer: null, watch: null };
  // However the element gets its size - mounted late, moved into a bigger
  // frame, the card resized - the map is told. A map built while its
  // element was off the page has no size at all until this fires.
  if (typeof window.ResizeObserver === "function") {
    entry.watch = new window.ResizeObserver(() => {
      if (entry.map) entry.map.resize();
    });
    entry.watch.observe(container);
  }
  return entry;
}

/**
 * A map for this widget: the one it kept, or - when that one is already
 * lent to a card still on the page - one of its own.
 */
export function take_map(key) {
  const kept = MAPS.get(key);
  if (kept && !kept.held) {
    if (kept.timer) {
      window.clearTimeout(kept.timer);
      kept.timer = null;
    }
    kept.held = true;
    return kept;
  }
  if (!kept) {
    const entry = new_entry(key);
    entry.held = true;
    MAPS.set(key, entry);
    return entry;
  }
  private_seq += 1;
  const own = new_entry(`${key}#${private_seq}`);
  own.held = true;
  own.private = true;
  MAPS.set(own.key, own);
  return own;
}

/** Puts the map's element in this frame and tells the map its new size. */
export function attach_map(entry, host) {
  if (!host || !entry) return;
  if (entry.container.parentNode !== host) host.appendChild(entry.container);
  if (entry.map) window.requestAnimationFrame(() => entry.map && entry.map.resize());
}

/**
 * Builds the map itself, once. The basemap style is fetched first, so a map
 * that cannot reach it still draws over the widget's own background.
 *
 * Whoever is waiting is told when it is up - not only whoever asked first.
 * A card that remounts while the map is still being built would otherwise
 * wait for a message already delivered to a component that is gone.
 */
export function start_map(entry, background, on_ready, on_failed) {
  entry.waiters = entry.waiters.concat({ on_ready, on_failed });
  if (entry.map || entry.starting) return;
  entry.starting = true;
  const tell = (what) => {
    const waiting = entry.waiters;
    entry.waiters = [];
    entry.starting = false;
    waiting.forEach((one) => one[what]());
  };
  resolve_style(background)
    .then((style) => {
      const map = new GlMap({
        container: entry.container,
        style,
        center: [30.06, -1.94],
        zoom: 9,
        minZoom: 0,
        maxZoom: 20,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      map.touchZoomRotate.disableRotation();
      entry.map = map;
      map.on("load", () => {
        entry.loaded = true;
        map.resize();
        tell("on_ready");
      });
    })
    // A map engine that cannot start (no WebGL, a blocked worker) must say
    // so with its retry, never leave an empty box behind.
    .catch(() => {
      entry.failed = true;
      tell("on_failed");
    });
}

function destroy(entry) {
  if (entry.watch) entry.watch.disconnect();
  if (entry.map) entry.map.remove();
  MAPS.delete(entry.key);
}

/** Throws this map away, so the next card to ask builds a new one. */
export function drop_map(key) {
  const entry = MAPS.get(key);
  if (entry) destroy(entry);
}

/** The card is gone - for a moment, or for good. */
export function release_map(entry) {
  if (!entry) return;
  entry.held = false;
  if (entry.container.parentNode) entry.container.parentNode.removeChild(entry.container);
  if (entry.private) {
    destroy(entry);
    return;
  }
  if (entry.timer) window.clearTimeout(entry.timer);
  entry.timer = window.setTimeout(() => {
    if (!entry.held) destroy(entry);
  }, EVICT_MS);
}
