import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { canvas_size, move_rect, resize_rect, snap_rect, bring_to_front, replace_item, clamp_rect } from "./screenshot/studioLayout.js";
import { spot_of, FREE_PAD } from "./boxLayout.js";
import { grow_rect, settle_rects, stack_rects, measure_need } from "./freeFlow.js";

/**
 * FREE PLACEMENT inside a section, worked exactly the way the screenshot
 * studio works - the same geometry, the same gesture, so what is learned
 * in one is true in the other.
 *
 * Every widget is a box of { x, y, w, h, z }. Pressing its body begins a
 * MOVE, pressing one of its four edges or four corners begins a RESIZE
 * from that side with the opposite one staying put. Only ONE gesture runs
 * at a time: what was pressed is remembered along with where the pointer
 * started and the box as it was, and every later movement is measured from
 * there - so a drag begun on a corner cannot finish as a move of something
 * else, and the pointer may leave the section without losing the box. The
 * window hears the rest of the gesture, which is what lets it end anywhere.
 *
 * Chaos is kept out three ways. Everything SNAPS to the edges and centres
 * of its neighbours and of the section, with the guide lines drawn while
 * the gesture is held. Nothing may leave the surface: a widget belongs to
 * the section it was put in, so it is stopped at the edges rather than
 * dragged off where nobody can reach it. And a surface with no height of
 * its own GROWS downwards with whatever is pushed past its bottom, so
 * nothing is cut off either.
 *
 * Nor is anything cut off INSIDE a box. The box the author drew is the
 * least a widget gets; what it holds is measured, and a widget taller than
 * its box - a chart resized under its own height, a title on two lines, a
 * section whose widgets grew - opens the box to fit, moving whatever was
 * designed below it down by as much (see freeFlow). A resize is held at
 * the content, so an edge stops where the chart would start to vanish.
 *
 * On a phone the arrangement gives way to a single column in reading
 * order, every widget the full width and as tall as it needs, instead of
 * the whole design drawn at postage-stamp size.
 *
 * A SECTION carries what is in it. Its widgets are drawn inside it, so
 * moving the section moves them with it and nothing has to be worked out.
 *
 * Placing is an edit like any other, so it only happens in STUDIO MODE
 * and what it writes waits on the working copy until it is saved.
 */

// zoom re-lays-out at the new size; the transform fallback only paints
// smaller, so it needs the height correcting.
const SUPPORTS_ZOOM = typeof CSS !== "undefined" && CSS.supports && CSS.supports("zoom", "1");

// The air kept between a box and every edge of its surface.
const EDGE_PAD = 5;

const EDGES = ["n", "s", "e", "w"];
const GRIPS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
const CLOSE_MARK = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/**
 * Watches one box's body for anything that changes what it needs: its
 * own size, the chart area's, the children of the area (a chart arriving
 * after its loading state, rows opened, a section growing) and the marks
 * the card leaves on the area. Every change asks for one measurement on
 * the next frame.
 */
function watch_body(body, on_change) {
  let frame = null;
  const schedule = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => {
      frame = null;
      on_change();
    });
  };
  const sizes = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
  const observe_area = () => {
    if (!sizes) return;
    const area = body.querySelector(".dcs-widget-area");
    if (!area) return;
    sizes.observe(area);
    Array.from(area.children).forEach((child) => sizes.observe(child));
  };
  if (sizes) sizes.observe(body);
  observe_area();
  const changes =
    typeof MutationObserver !== "undefined"
      ? new MutationObserver(() => {
          observe_area();
          schedule();
        })
      : null;
  if (changes) changes.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-filled", "data-base-need"] });
  schedule();
  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    if (sizes) sizes.disconnect();
    if (changes) changes.disconnect();
  };
}

export default function CanvasFreeLayer({ list, width, height, scale, placeable, stacked, onPlace, onRemove }) {
  // The pointer travels in screen pixels; the surface may be drawn smaller.
  const factor = Number(scale) > 0 ? Number(scale) : 1;
  const factor_ref = useRef(factor);
  factor_ref.current = factor;
  const surface_ref = useRef(null);
  const bodies_ref = useRef(new Map());
  const [room, setRoom] = useState(0);
  const [active_id, setActiveId] = useState(null);
  const [guides, setGuides] = useState({ x: [], y: [] });
  const [moving_id, setMovingId] = useState(null);
  // What each box's content needs, by widget id: { h, firm }.
  const [wants, setWants] = useState({});
  const wants_ref = useRef(wants);
  wants_ref.current = wants;
  const gesture_ref = useRef(null);
  const rects_ref = useRef([]);
  const { translate } = useDcsLanguage();
  const remove_label = translate("DCS_DB_REMOVE_WIDGET");

  // How wide the surface really is, which is what a widget is held inside.
  const bounds = { w: width || room, h: 0 };
  // Drawn as well as dragged inside the edges: a spot saved on a wider
  // screen is pulled in rather than left hanging off the side.
  const designed = list.map((entry, index) => {
    const spot = Object.assign({ id: entry.widget.id }, spot_of(entry.widget.box, index));
    return bounds.w > 0 ? clamp_rect(spot, bounds, EDGE_PAD) : spot;
  });
  rects_ref.current = designed;
  const bounds_ref = useRef(bounds);
  bounds_ref.current = bounds;
  const needs = designed.map((rect) => wants[rect.id]);
  // What is DRAWN: the design opened up to its content, or, on a phone,
  // one column of it.
  const rects = stacked && bounds.w > 0 ? stack_rects(designed, needs, bounds.w, EDGE_PAD) : settle_rects(designed, designed.map((rect, index) => grow_rect(rect, needs[index])));
  // The surface is as tall as the lowest thing on it, and never shorter
  // than the room the section itself was given.
  const base = { w: 0, h: Math.max(height || 0, 160) };
  const surface = canvas_size(rects, base);
  // Wider than the room it has, a surface is drawn smaller to fit, so the
  // widgets on it never run out past the section's right edge.
  const fit = !stacked && !width && room > 0 && surface.w > room ? room / surface.w : 1;
  const fit_ref = useRef(fit);
  fit_ref.current = fit;

  // One gesture at a time, heard by the window so it can end anywhere.
  useEffect(() => {
    const on_move = (event) => {
      const gesture = gesture_ref.current;
      if (!gesture) return;
      const dx = (event.clientX - gesture.origin_x) / (factor_ref.current * fit_ref.current);
      const dy = (event.clientY - gesture.origin_y) / (factor_ref.current * fit_ref.current);
      // A press that never travels is a CLICK, and a click still selects.
      // Only real travel turns the press into a placement, and only then
      // is the widget lifted above the others.
      if (!gesture.live) {
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        gesture.live = true;
        gesture.start = bring_to_front(rects_ref.current, gesture.id).find((entry) => entry.id === gesture.id);
        if (gesture.kind === "move") setMovingId(gesture.id);
      }
      event.preventDefault();
      const moved_rect = gesture.kind === "move" ? move_rect(gesture.start, dx, dy) : resize_rect(gesture.start, gesture.kind, dx, dy);
      const raw = clamp_rect(moved_rect, bounds_ref.current, EDGE_PAD);
      const others = rects_ref.current.filter((entry) => entry.id !== gesture.id);
      const snapped = snap_rect(raw, gesture.kind, others, canvas_size(others.concat([raw]), base));
      snapped.rect = clamp_rect(snapped.rect, bounds_ref.current, EDGE_PAD);
      // A resize stops at the content: the box is never dragged shorter
      // than what it holds. From the top edge, the bottom stays put.
      const want = wants_ref.current[gesture.id];
      if (gesture.kind !== "move" && want && want.firm && snapped.rect.h < want.h) {
        if (gesture.kind.indexOf("n") >= 0) snapped.rect.y = gesture.start.y + gesture.start.h - want.h;
        snapped.rect.h = want.h;
      }
      setGuides(snapped.guides);
      onPlace(gesture.id, replace_item([gesture.start], gesture.id, snapped.rect)[0]);
    };
    const on_up = () => {
      if (!gesture_ref.current) return;
      gesture_ref.current = null;
      setMovingId(null);
      setGuides({ x: [], y: [] });
    };
    window.addEventListener("pointermove", on_move);
    window.addEventListener("pointerup", on_up);
    window.addEventListener("pointercancel", on_up);
    return () => {
      window.removeEventListener("pointermove", on_move);
      window.removeEventListener("pointerup", on_up);
      window.removeEventListener("pointercancel", on_up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPlace, base.h]);

  const start = (id, kind) => (event) => {
    if (!placeable || !onPlace || event.button !== 0) return;
    // The body's press is left alone so a click on the card still reaches
    // it; a grip has nothing else to be, so it is taken outright.
    if (kind !== "move") event.preventDefault();
    event.stopPropagation();
    const held = rects_ref.current.find((entry) => entry.id === id);
    if (!held) return;
    // WHAT WAS PRESSED is remembered here and nowhere else: the rest of
    // the gesture belongs to it until the pointer is let go.
    setActiveId(id);
    gesture_ref.current = { id, kind, start: held, origin_x: event.clientX, origin_y: event.clientY, live: false };
  };

  useEffect(() => {
    const measure = () => {
      if (surface_ref.current) setRoom(surface_ref.current.clientWidth);
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (observer && surface_ref.current) observer.observe(surface_ref.current);
    return () => {
      if (observer) observer.disconnect();
    };
  }, []);

  // Every box's content is watched and measured; a need is only written
  // when it really changed, so measuring never re-renders for nothing.
  const ids_key = list.map((entry) => entry.widget.id).join("|");
  useEffect(() => {
    const stops = [];
    bodies_ref.current.forEach((body, id) => {
      if (!body) return;
      stops.push(
        watch_body(body, () => {
          const need = measure_need(body);
          if (!need) return;
          setWants((current) => {
            const held = current[id];
            if (held && Math.abs(held.h - need.h) <= 1 && held.firm === need.firm) return current;
            return Object.assign({}, current, { [id]: need });
          });
        }),
      );
    });
    return () => stops.forEach((stop) => stop());
  }, [ids_key]);

  const hold_body = (id) => (element) => {
    if (element) bodies_ref.current.set(id, element);
    else bodies_ref.current.delete(id);
  };

  return (
    <div
      ref={surface_ref}
      className="dcs-canvas-free relative"
      // With the fit the page still reserves the unfitted height under a
      // transform, so the outer box is told what the fitted surface comes
      // to; zoom re-lays-out and needs nothing.
      style={{ minHeight: SUPPORTS_ZOOM || fit === 1 ? surface.h + FREE_PAD : undefined, height: !SUPPORTS_ZOOM && fit < 1 ? Math.ceil((surface.h + FREE_PAD) * fit) : undefined }}
      onPointerDown={() => setActiveId(null)}
    >
      <div
        className="relative"
        style={
          fit === 1
            ? { minHeight: surface.h + FREE_PAD }
            : SUPPORTS_ZOOM
              ? { width: surface.w, minHeight: surface.h + FREE_PAD, zoom: fit }
              : { width: surface.w, minHeight: surface.h + FREE_PAD, transform: `scale(${fit})`, transformOrigin: "top left" }
        }
      >
      {list.map((entry, index) => {
        const rect = rects[index];
        const id = entry.widget.id;
        return (
          <div
            key={id}
            className={`dcs-canvas-spot ${placeable ? "dcs-studio-item" : ""} ${placeable && active_id === id ? "is-active" : ""} ${moving_id === id ? "is-moving" : ""}`}
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: rect.z }}
            onPointerDown={start(id, "move")}
          >
            <div ref={hold_body(id)} className={`dcs-canvas-spot-body ${placeable ? "is-still" : ""}`}>
              {entry.node}
            </div>
            {placeable && (
              <>
                {EDGES.map((edge) => (
                  <div key={edge} className={`dcs-studio-edge is-${edge}`} onPointerDown={start(id, edge)} />
                ))}
                {GRIPS.map((grip) => (
                  <div key={grip} className={`dcs-studio-handle is-${grip}`} onPointerDown={start(id, grip)} />
                ))}
                {onRemove && (
                  <button
                    type="button"
                    className="dcs-studio-remove"
                    title={remove_label}
                    aria-label={remove_label}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(id);
                    }}
                  >
                    {CLOSE_MARK}
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
      {guides.x.map((at) => (
        <div key={`x${at}`} className="dcs-studio-guide is-x" style={{ left: at }} />
      ))}
      {guides.y.map((at) => (
        <div key={`y${at}`} className="dcs-studio-guide is-y" style={{ top: at }} />
      ))}
      </div>
    </div>
  );
}
