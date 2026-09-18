/**
 * The geometry of the screenshot studio: free-floating widget boxes on a
 * canvas that can be moved, resized from any edge or corner, stacked and
 * snapped into alignment with each other and with the canvas. Pure
 * functions over plain { id, x, y, w, h, z } records, so they are testable
 * without a browser.
 */

export const MIN_W = 120;
export const MIN_H = 80;
export const SNAP_PX = 6;
export const CANVAS_PAD = 0;

/** The studio's starting boxes: the cards exactly where the board showed them. */
export function initial_items(rects) {
  return (rects || [])
    .filter((rect) => rect && rect.id)
    .map((rect, index) => ({
      id: rect.id,
      x: Math.max(0, Math.round(rect.x)),
      y: Math.max(0, Math.round(rect.y)),
      w: Math.max(MIN_W, Math.round(rect.w)),
      h: Math.max(MIN_H, Math.round(rect.h)),
      z: index + 1,
    }));
}

/** The canvas grows with whatever is dragged past its edges, never below the board's own size. */
export function canvas_size(items, base) {
  const right = Math.max(0, ...items.map((item) => item.x + item.w));
  const bottom = Math.max(0, ...items.map((item) => item.y + item.h));
  return { w: Math.max(base.w || 0, right + CANVAS_PAD), h: Math.max(base.h || 0, bottom + CANVAS_PAD) };
}

export function move_rect(start, dx, dy) {
  return { ...start, x: Math.max(0, start.x + dx), y: Math.max(0, start.y + dy) };
}

/**
 * Resizes from one handle: "n", "s", "e", "w" or a corner ("ne", "sw"...).
 * The opposite edge stays put; the box never shrinks below the minimum.
 */
export function resize_rect(start, direction, dx, dy) {
  let { x, y, w, h } = start;
  if (direction.includes("e")) w = Math.max(MIN_W, start.w + dx);
  if (direction.includes("s")) h = Math.max(MIN_H, start.h + dy);
  if (direction.includes("w")) {
    const next_w = Math.max(MIN_W, start.w - dx);
    x = Math.max(0, start.x + (start.w - next_w));
    w = next_w;
  }
  if (direction.includes("n")) {
    const next_h = Math.max(MIN_H, start.h - dy);
    y = Math.max(0, start.y + (start.h - next_h));
    h = next_h;
  }
  return { ...start, x, y, w, h };
}

/**
 * Keeps a box INSIDE the surface it belongs to.
 *
 * A widget dropped in a section belongs to that section: it may be put
 * anywhere on it and nowhere off it, so a box pushed at an edge is stopped
 * at the edge rather than escaping to where nobody can reach it. A box too
 * big for the surface is narrowed to it first, because a box that cannot
 * fit has no inside position to be clamped to.
 *
 * A surface with no height given (one that grows downwards as things are
 * pushed past its bottom) is only clamped across. inset is the air kept
 * between a box and every edge, so nothing sits flush on the side.
 */
export function clamp_rect(rect, room, inset) {
  const pad = Number(inset) > 0 ? Number(inset) : 0;
  const wide = Number(room && room.w) > 0 ? Number(room.w) : 0;
  const tall = Number(room && room.h) > 0 ? Number(room.h) : 0;
  const across = wide ? Math.max(1, wide - pad * 2) : 0;
  const down = tall ? Math.max(1, tall - pad * 2) : 0;
  const w = across ? Math.max(Math.min(rect.w, across), Math.min(MIN_W, across)) : rect.w;
  const h = down ? Math.max(Math.min(rect.h, down), Math.min(MIN_H, down)) : rect.h;
  return {
    ...rect,
    w,
    h,
    x: across ? Math.max(pad, Math.min(rect.x, pad + across - w)) : Math.max(pad, rect.x),
    y: down ? Math.max(pad, Math.min(rect.y, pad + down - h)) : Math.max(pad, rect.y),
  };
}

function nearest(value, candidates, threshold) {
  let best = null;
  candidates.forEach((candidate) => {
    const delta = candidate - value;
    if (Math.abs(delta) <= threshold && (best === null || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: candidate };
  });
  return best;
}

/**
 * Pulls a box into alignment with the other boxes' edges and centres and
 * with the canvas edges and centre, when it comes within the threshold.
 * Moving snaps left / right / centre and top / bottom / centre; resizing
 * snaps only the edges being pulled. Returns the snapped box and the guide
 * lines (canvas x and y positions) to draw while it is held.
 */
export function snap_rect(rect, kind, others, canvas, threshold) {
  const limit = threshold === undefined ? SNAP_PX : threshold;
  const xs = [0, canvas.w, canvas.w / 2];
  const ys = [0, canvas.h, canvas.h / 2];
  others.forEach((other) => {
    xs.push(other.x, other.x + other.w, other.x + other.w / 2);
    ys.push(other.y, other.y + other.h, other.y + other.h / 2);
  });
  const guides = { x: [], y: [] };
  let next = { ...rect };

  const edges_x = kind === "move" ? ["left", "right", "center"] : [kind.includes("w") && "left", kind.includes("e") && "right"].filter(Boolean);
  const edges_y = kind === "move" ? ["top", "bottom", "center"] : [kind.includes("n") && "top", kind.includes("s") && "bottom"].filter(Boolean);

  const probe_x = { left: next.x, right: next.x + next.w, center: next.x + next.w / 2 };
  let best_x = null;
  edges_x.forEach((edge) => {
    const hit = nearest(probe_x[edge], xs, limit);
    if (hit && (best_x === null || Math.abs(hit.delta) < Math.abs(best_x.delta))) best_x = { ...hit, edge };
  });
  if (best_x) {
    if (kind === "move" || best_x.edge === "left") {
      if (best_x.edge === "left" && kind !== "move") next.w = Math.max(MIN_W, next.w - best_x.delta);
      next.x = Math.max(0, next.x + best_x.delta);
    } else next.w = Math.max(MIN_W, next.w + best_x.delta);
    guides.x.push(best_x.at);
  }

  const probe_y = { top: next.y, bottom: next.y + next.h, center: next.y + next.h / 2 };
  let best_y = null;
  edges_y.forEach((edge) => {
    const hit = nearest(probe_y[edge], ys, limit);
    if (hit && (best_y === null || Math.abs(hit.delta) < Math.abs(best_y.delta))) best_y = { ...hit, edge };
  });
  if (best_y) {
    if (kind === "move" || best_y.edge === "top") {
      if (best_y.edge === "top" && kind !== "move") next.h = Math.max(MIN_H, next.h - best_y.delta);
      next.y = Math.max(0, next.y + best_y.delta);
    } else next.h = Math.max(MIN_H, next.h + best_y.delta);
    guides.y.push(best_y.at);
  }
  return { rect: next, guides };
}

/** Lifts one box above every other. */
export function bring_to_front(items, id) {
  const top = Math.max(0, ...items.map((item) => item.z));
  return items.map((item) => (item.id === id ? { ...item, z: top + 1 } : item));
}

export function replace_item(items, id, rect) {
  return items.map((item) => (item.id === id ? { ...item, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) } : item));
}

/** A safe file name from a dashboard's name. */
export function file_name_of(name) {
  const cleaned = String(name || "dashboard")
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return cleaned || "dashboard";
}
