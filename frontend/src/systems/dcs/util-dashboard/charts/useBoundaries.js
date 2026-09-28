import { useEffect, useState } from "react";
import { bounds_of, map_key, grow_box } from "./mapGeometry.js";

/**
 * The boundaries a world map draws, and how they are asked for.
 *
 * ONLY NAMES THE MAP HAS NEVER SEEN are ever requested: everything it has
 * been given is kept (see mapKeeper), so filtering a board down to a few
 * places, and back out again, costs little. The request says which names
 * are already held and at which level, and the answer says whether they
 * still stand - a level that has moved (districts to sectors) is a
 * different map, and what was held is let go.
 *
 * The answer also carries the REST of the drawn level under the board's
 * filters - every place the widget did not name - so the level is drawn
 * whole, the places nobody answered left pale. That part follows the
 * board's filters, so a change of filters asks again even when every name
 * is already held, and a widget with no rows at all still asks, and draws
 * the whole level it is looking at.
 *
 * A heat map asks for nothing at all: it is drawn from the records
 * themselves, not from named shapes.
 */

const chain_of = (shape) => (shape.path || []).concat(shape.name).join("/");

/** Why the boundaries did not come, with the server's own reason when it gave one. */
function failure_text(error, translate) {
  const reason = error && typeof error.message === "string" ? error.message.trim() : "";
  const base = translate("DCS_DB_MAP_FAILED");
  return reason ? `${base} (${reason})` : base;
}

export function use_boundaries({ heat, names, names_key, scope_key, attempt, cache, fetch_shapes, translate }) {
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (heat) {
      setStatus({ loading: false, error: "" });
      return undefined;
    }
    if (!fetch_shapes) {
      setStatus({ loading: false, error: translate("DCS_DB_MAP_NO_SOURCE") });
      return undefined;
    }
    if (!cache.context) cache.context = new Map();
    const missing = names.filter((name) => !cache.places.has(map_key(name)) && !cache.unknown.has(map_key(name)));
    if (missing.length === 0 && cache.level && cache.scope === scope_key) {
      setStatus({ loading: false, error: "" });
      return undefined;
    }
    let alive = true;
    setStatus({ loading: true, error: "" });
    const held = { have: Array.from(cache.places.values()).map((entry) => entry.asked), have_level: cache.level, have_context: !!cache.level && cache.scope === scope_key && cache.context.size > 0 };
    Promise.resolve(fetch_shapes(names, held))
      .then((response) => {
        const answer = (response && response.data) || response || null;
        if (!alive) return;
        if (!answer || typeof answer !== "object") {
          setStatus({ loading: false, error: translate("DCS_DB_MAP_FAILED") });
          return;
        }
        if (answer.kept !== true) {
          cache.places.clear();
          cache.parents.clear();
          cache.context.clear();
          cache.unknown.clear();
          cache.box = null;
        }
        cache.level = answer.level || cache.level;
        cache.scope = scope_key;
        // How far everything this map has been given reaches, kept as it
        // arrives: it is what "Reset" goes back to.
        (answer.shapes || []).forEach((shape) => {
          const key = map_key(shape.asked || shape.name);
          if (!cache.places.has(key)) cache.places.set(key, { asked: shape.asked || shape.name, list: [] });
          cache.places.get(key).list.push(shape);
          cache.box = grow_box(cache.box, bounds_of([shape]));
        });
        (answer.parents || []).forEach((entry) =>
          entry.shapes.forEach((shape) => {
            cache.parents.set(chain_of(shape), { ...shape, level: entry.level });
            cache.box = grow_box(cache.box, bounds_of([shape]));
          }),
        );
        if (Array.isArray(answer.context)) {
          cache.context.clear();
          answer.context.forEach((shape) => {
            cache.context.set(chain_of(shape), shape);
            cache.box = grow_box(cache.box, bounds_of([shape]));
          });
        }
        (answer.unknown || []).forEach((name) => cache.unknown.add(map_key(name)));
        setVersion((current) => current + 1);
        setStatus({ loading: false, error: "" });
      })
      .catch((error) => alive && setStatus({ loading: false, error: failure_text(error, translate) }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heat, names_key, scope_key, attempt]);

  return { status, version };
}
