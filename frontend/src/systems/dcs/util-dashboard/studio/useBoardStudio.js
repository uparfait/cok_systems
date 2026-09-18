import { useCallback, useState } from "react";
import { default_box, is_studio, studio_layout } from "../boxLayout.js";
import { initial_items } from "../screenshot/studioLayout.js";

/**
 * The board as the studio first sees it: every widget at the place and the
 * size the board was just showing it, exactly as the screenshot studio
 * opens on the board it was opened from. A widget that already has a spot
 * of its own keeps it - it was placed by hand once and that stands - and
 * a widget inside a section is measured against its section, since that is
 * the surface it is placed on.
 */
function seeded(widgets, seed) {
  const rects = new Map(initial_items((seed && seed.rects) || []).map((rect) => [rect.id, rect]));
  const by_id = new Map(widgets.map((widget) => [widget.id, widget]));
  return widgets.map((widget) => {
    const copy = { ...widget };
    if (copy.box && copy.box.spot) return copy;
    const rect = rects.get(widget.id);
    if (!rect) return copy;
    const parent = widget.parent_id ? rects.get(widget.parent_id) : null;
    const held = parent && by_id.has(widget.parent_id) ? parent : { x: 0, y: 0 };
    copy.box = Object.assign({}, copy.box || (widget.parent_id ? default_box() : {}), {
      spot: { x: Math.max(0, rect.x - held.x), y: Math.max(0, rect.y - held.y), w: rect.w, h: rect.h, z: rect.z },
    });
    return copy;
  });
}

/**
 * STUDIO MODE: the one mode a dashboard is edited in.
 *
 * It opens full screen and turns the board into a surface. Widgets are
 * dragged to place them, pulled by their edges to size them, dropped onto
 * one another to move them into or out of a section, and removed. All of
 * it happens on a WORKING COPY - the widget list and how the board is
 * arranged - and none of it reaches the server until Save changes is
 * pressed. Discard puts the copy back to what was saved without leaving;
 * Exit leaves, asking first when there is something to lose.
 *
 * There is no selecting here and nothing is edited in bulk: what the mode
 * is for is the arrangement, and the arrangement is done by hand.
 */
export function useBoardStudio(widgets, layout) {
  const [active, setActive] = useState(false);
  const [working, setWorking] = useState([]);
  const [draft_layout, setDraftLayout] = useState(null);
  const [dirty, setDirty] = useState(false);

  // Entering ARRANGES the board: there is nothing to place or resize on a
  // grid that lays itself out. A board already arranged keeps the width it
  // was arranged at, so its placements still mean what they meant.
  // The width the board is arranged at is the width it was MEASURED at
  // on the way in, so what the studio shows is what the board showed.
  const fresh_layout = useCallback(
    (seed) => (is_studio(layout) ? layout : studio_layout((seed && seed.base && seed.base.w) || (layout && layout.width) || (typeof window === "undefined" ? undefined : window.innerWidth))),
    [layout],
  );
  const [last_seed, setLastSeed] = useState(null);

  const enter = useCallback(
    (seed) => {
      setLastSeed(seed || null);
      setWorking(seeded(widgets, seed));
      setDraftLayout(fresh_layout(seed));
      setDirty(false);
      setActive(true);
    },
    [widgets, fresh_layout],
  );

  // Discarding goes back to what was saved, seen the way it was seen.
  const discard = useCallback(() => {
    setWorking(seeded(widgets, last_seed));
    setDraftLayout(fresh_layout(last_seed));
    setDirty(false);
  }, [widgets, fresh_layout, last_seed]);

  const exit = useCallback(() => {
    setActive(false);
    setWorking([]);
    setDraftLayout(null);
    setDirty(false);
  }, []);

  const set_layout = useCallback((next) => {
    setDraftLayout(next);
    setDirty(true);
  }, []);

  /** Where one widget sits on the surface that holds it. */
  const place = useCallback((id, spot) => {
    setWorking((current) => current.map((widget) => (widget.id === id ? { ...widget, box: Object.assign({}, widget.box || default_box(), { spot }) } : widget)));
    setDirty(true);
  }, []);

  /** A section's own size, written by its grips. */
  const resize = useCallback((id, canvas) => {
    setWorking((current) => current.map((widget) => (widget.id === id ? { ...widget, canvas } : widget)));
    setDirty(true);
  }, []);

  /**
   * Removing one widget takes whatever it holds with it: a section that
   * goes leaves nothing of its contents stranded on a board with no place
   * to draw them.
   */
  const remove = useCallback((id) => {
    setWorking((current) => {
      const going = descendants_of(current, id);
      going.add(id);
      return current.filter((widget) => !going.has(widget.id)).map((widget, index) => ({ ...widget, position: index }));
    });
    setDirty(true);
  }, []);

  /**
   * Moves one widget to the place of the one it was dropped on, and INTO
   * whatever holds that one - so a widget dropped on something inside a
   * section joins the section, and one dropped on the board leaves it.
   * A section cannot be dropped inside itself or inside anything it holds.
   */
  const move = useCallback((from_id, to_id) => {
    if (!from_id || !to_id || from_id === to_id) return;
    setWorking((current) => {
      const from = current.findIndex((widget) => widget.id === from_id);
      const to = current.findIndex((widget) => widget.id === to_id);
      if (from === -1 || to === -1) return current;
      if (descendants_of(current, from_id).has(to_id)) return current;
      const parent_id = current[to].parent_id || null;
      const next = current.slice();
      const [moved] = next.splice(from, 1);
      const placed = { ...moved, parent_id };
      if (parent_id && !placed.box) placed.box = default_box();
      if (!parent_id) placed.box = placed.box ? { ...placed.box } : null;
      next.splice(to, 0, placed);
      return next.map((widget, index) => ({ ...widget, position: index }));
    });
    setDirty(true);
  }, []);

  return { active, working, dirty, layout: draft_layout, enter, exit, discard, set_layout, move, place, resize, remove };
}

/** Every widget held by one, and by the ones it holds, all the way down. */
export function descendants_of(widgets, id) {
  const found = new Set();
  let growing = true;
  while (growing) {
    growing = false;
    widgets.forEach((widget) => {
      if (!widget.parent_id || found.has(widget.id)) return;
      if (widget.parent_id === id || found.has(widget.parent_id)) {
        found.add(widget.id);
        growing = true;
      }
    });
  }
  return found;
}
