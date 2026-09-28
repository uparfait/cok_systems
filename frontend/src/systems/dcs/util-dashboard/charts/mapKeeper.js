import { Map as GlMap } from "maplibre-gl";
import { blank_style } from "./mapDraw.js";
import { cached_basemap, load_basemap, apply_basemap, retries_left, retry_delay } from "./basemap.js";

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
  if (!CACHES.has(key)) CACHES.set(key, { level: "", scope: "", places: new Map(), parents: new Map(), context: new Map(), unknown: new Set(), box: null });
  return CACHES.get(key);
}

function new_entry(key) {
  const container = document.createElement("div");
  // MapLibre's own stylesheet sets position: relative on its container,
  // which would take the frame's height away from it, so the size is
  // written on the element itself where no stylesheet can reach.
  container.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  const entry = { key, container, map: null, loaded: false, failed: false, starting: false, dropped: false, waiters: [], held: false, heat: "", fitted: null, timer: null, watch: null, basemap: "loading", basemap_style: null, basemap_attempt: 0, basemap_timer: null, basemap_watchers: [] };
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
 * Builds the map itself, once, and at once: on the basemap this browser
 * already holds, or on a plain ground while the basemap is fetched beside
 * it (see basemap.js) - the boundaries never wait for another server.
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
  const cached = cached_basemap();
  let map;
  try {
    map = new GlMap({
      container: entry.container,
      style: cached || blank_style(background),
      center: [30.06, -1.94],
      zoom: 9,
      minZoom: 0,
      maxZoom: 20,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
  } catch (error) {
    // A map engine that cannot start (no WebGL, a blocked worker) must say
    // so with its retry, never leave an empty box behind.
    entry.failed = true;
    tell("on_failed");
    return;
  }
  map.touchZoomRotate.disableRotation();
  entry.map = map;
  // The card is told the moment the STYLE is in - when the widget's own
  // layers can be added - and never made to wait for the basemap's tiles,
  // sprite and fonts: those fill in behind the boundaries as they arrive.
  let told = false;
  const up = () => {
    if (told || entry.dropped) return;
    told = true;
    entry.loaded = true;
    map.resize();
    tell("on_ready");
  };
  map.once("style.load", up);
  map.once("load", up);
  if (cached) {
    entry.basemap_style = cached;
    set_basemap(entry, "loading");
    await_ground(entry);
  } else seek_basemap(entry);
}

// How long a basemap that is in may take to fill its ground with tiles
// before the card says it did not come.
const GROUND_TIMEOUT = 90000;

function set_basemap(entry, state) {
  entry.basemap = state;
  entry.basemap_watchers.forEach((watch) => watch(state));
}

function clear_basemap_timer(entry) {
  if (entry.basemap_timer) window.clearTimeout(entry.basemap_timer);
  entry.basemap_timer = null;
}

/** The basemap is in: its tiles are awaited, and a ground that never fills is reported. */
function await_ground(entry) {
  const map = entry.map;
  if (!map) return;
  clear_basemap_timer(entry);
  const done = () => {
    if (entry.dropped) return;
    clear_basemap_timer(entry);
    set_basemap(entry, "ready");
  };
  map.once("idle", done);
  entry.basemap_timer = window.setTimeout(() => {
    map.off("idle", done);
    if (!entry.dropped && entry.basemap !== "ready") set_basemap(entry, "missing");
  }, GROUND_TIMEOUT);
}

/**
 * Fetches the basemap and slides it under the widget's layers when it
 * comes; a fetch that fails is tried again on its own, then left to the
 * viewer's retry.
 */
function seek_basemap(entry) {
  if (entry.dropped || !entry.map) return;
  set_basemap(entry, "loading");
  load_basemap()
    .then((style) => {
      if (entry.dropped || !entry.map) return;
      entry.basemap_style = style;
      apply_basemap(entry.map, style);
      await_ground(entry);
    })
    .catch(() => {
      if (entry.dropped) return;
      if (retries_left(entry.basemap_attempt)) {
        const delay = retry_delay(entry.basemap_attempt);
        entry.basemap_attempt += 1;
        entry.basemap_timer = window.setTimeout(() => seek_basemap(entry), delay);
        return;
      }
      set_basemap(entry, "missing");
    });
}

/** Tells the card how the basemap stands, now and whenever that changes; returns the way to stop listening. */
export function watch_basemap(entry, watch) {
  entry.basemap_watchers = entry.basemap_watchers.concat(watch);
  watch(entry.basemap);
  return () => {
    entry.basemap_watchers = entry.basemap_watchers.filter((one) => one !== watch);
  };
}

/** The viewer asks again for a basemap that did not come. */
export function retry_basemap(entry) {
  if (!entry || entry.dropped || !entry.map || entry.basemap === "ready") return;
  clear_basemap_timer(entry);
  entry.basemap_attempt = 0;
  if (entry.basemap_style) {
    set_basemap(entry, "loading");
    apply_basemap(entry.map, entry.basemap_style);
    await_ground(entry);
    return;
  }
  seek_basemap(entry);
}

function destroy(entry) {
  // A map still being built when it is dropped must not come up later and
  // tell a card that has since moved on; and a stale entry must never
  // unregister the one that took its place.
  entry.dropped = true;
  entry.waiters = [];
  entry.basemap_watchers = [];
  clear_basemap_timer(entry);
  if (entry.watch) entry.watch.disconnect();
  if (entry.map) entry.map.remove();
  if (MAPS.get(entry.key) === entry) MAPS.delete(entry.key);
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
