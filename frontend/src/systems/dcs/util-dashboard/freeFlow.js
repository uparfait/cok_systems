/**
 * How a free surface KEEPS WHAT IT HOLDS IN VIEW.
 *
 * A box on the surface is a wish: the author's width and height. What is
 * drawn is the wish or the content, whichever is taller, so a chart
 * resized under its own height, a title that wrapped onto a second line
 * or a section whose widgets grew all push their box open rather than
 * disappear behind its edge. Nothing is ever cut off; a box only grows.
 *
 * Growing must not swallow the neighbours below: a box designed under one
 * that grew is moved down by as much, keeping the gap it was designed
 * with, and the boxes under it follow. Boxes laid over each other on
 * purpose are left exactly as they were.
 *
 * On a narrow screen the arrangement itself gives way: every box takes the
 * whole width, in reading order (top to bottom, then left to right), each
 * as tall as it needs. A design made for a desk is read on a phone as a
 * column instead of a postage stamp.
 *
 * Pure functions over { id, x, y, w, h, z } records and { h, firm } needs.
 */

export const STACK_GAP = 12;
export const NARROW_PX = 640;
export const SLACK = 2;

const need_h = (want) => (want && Number(want.h) > 0 ? Number(want.h) + SLACK : 0);

/** A box drawn no shorter than its content. */
export function grow_rect(rect, want) {
  return { ...rect, h: Math.max(rect.h, need_h(want)) };
}

const across = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w;

/** Reading order: top to bottom, then left to right. */
export function reading_order(rects) {
  return rects.map((rect, index) => index).sort((a, b) => rects[a].y - rects[b].y || rects[a].x - rects[b].x);
}

/**
 * The drawn boxes, with every box that sits under one that grew moved
 * down to keep its designed gap. Only pairs that did not overlap in the
 * design are kept apart; a deliberate overlap stays a deliberate overlap.
 */
export function settle_rects(designed, drawn) {
  const order = reading_order(designed);
  const placed = drawn.map((rect) => ({ ...rect }));
  order.forEach((index, at) => {
    const own = designed[index];
    for (let k = 0; k < at; k += 1) {
      const over = order[k];
      const above = designed[over];
      const designed_bottom = above.y + above.h;
      if (designed_bottom > own.y || !across(placed[over], placed[index])) continue;
      const floor = placed[over].y + placed[over].h + (own.y - designed_bottom);
      if (placed[index].y < floor) placed[index].y = floor;
    }
  });
  return placed;
}

/** The boxes as one full-width column for a narrow screen. */
export function stack_rects(designed, wants, room_w, pad) {
  const w = Math.max(1, room_w - pad * 2);
  const out = new Array(designed.length);
  let y = pad;
  reading_order(designed).forEach((index) => {
    const rect = designed[index];
    const h = Math.max(rect.h, need_h(wants[index]));
    out[index] = { ...rect, x: pad, y, w, h, z: 1 };
    y += h + STACK_GAP;
  });
  return out;
}

/**
 * What the content inside a box needs, read off the card's chart area:
 * the card's own chrome (title, paddings, borders) plus what is in the
 * area. A chart that FILLS the room it was given reports the height it
 * would draw at on its own, so a box made taller than its chart can be
 * made shorter again down to that. Anything else reports the room its
 * children take, overflow included, so a box made shorter than its
 * content grows back to it, and a box with room to spare may be pulled
 * in to it. A child that merely stretches to whatever room it is given
 * says nothing about what it holds, so it asks for nothing: the box keeps
 * its designed height until the child really overflows.
 *
 * Firm needs are the ones a resize is held at.
 */
const NOTHING = { h: 0, firm: false };

export function measure_need(body) {
  if (!body) return null;
  const area = body.querySelector(".dcs-widget-area");
  if (!area) return body.scrollHeight > body.clientHeight + 1 ? { h: body.scrollHeight, firm: true } : NOTHING;
  const chrome = body.clientHeight - area.clientHeight;
  const base = Number(area.dataset.baseNeed) || 0;
  if (area.dataset.filled === "1") return { h: chrome + base, firm: true };
  let extent = 0;
  Array.from(area.children).forEach((child) => {
    extent += Math.max(child.offsetHeight, child.scrollHeight);
  });
  const content = Math.max(base, extent);
  if (content > area.clientHeight + 1) return { h: chrome + content, firm: true };
  if (extent > 0 && Math.abs(extent - area.clientHeight) <= 1) return NOTHING;
  return { h: chrome + content, firm: content > 0 };
}
