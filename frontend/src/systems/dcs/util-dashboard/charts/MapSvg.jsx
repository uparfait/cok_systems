import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { readable_on } from "../appearance.js";
import LibraryIcon from "../icons/LibraryIcon.jsx";
import { bounds_of, points_box } from "./mapGeometry.js";
import { mix } from "./heatScale.js";
import { fit_projection, viewed, shape_path, screen_box, view_on, zoomed, HOME_VIEW } from "./mapProjection.js";

const PADDING = 18;
const PLACE_PADDING = 40;
const MAX_K = 64;
const MAX_PLACES = 400;
const DRAG_SLACK = 3;
// How far around a clicked dot the other dots count as the same spot, in
// pixels, and the hair of a degree a box is widened by so the dots
// themselves lie inside it.
const DOT_REACH = 10;
const GEO_SLACK = 0.00001;
const LETTER_WIDTH = 0.6;
const FONT = "'Montserrat', sans-serif";

function use_size(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const read = () => setSize({ w: element.clientWidth, h: element.clientHeight });
    read();
    if (typeof window.ResizeObserver !== "function") return undefined;
    const observer = new window.ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

function mark_row(marks, size, format) {
  const font = Math.max(10, Math.round(size * 0.42));
  const glyph = Math.round(size * 0.55);
  const pad = Math.max(4, Math.round(size * 0.18));
  const laid = marks.map((mark) => {
    const text = format(mark.count);
    const width = Math.max(size, pad + glyph + 3 + text.length * font * LETTER_WIDTH + pad);
    return { ...mark, text, width, font, glyph, pad, ink: readable_on(mark.color, null) };
  });
  const total = laid.reduce((sum, mark) => sum + mark.width, 0) + Math.max(0, laid.length - 1) * 2;
  let cursor = -total / 2;
  return laid.map((mark) => {
    const left = cursor;
    cursor += mark.width + 2;
    return { ...mark, left };
  });
}

const MapSvg = forwardRef(function MapSvg({ shapes, outlines, describeLand, describeOutline, signature, places, heat, colors, theme, icon, markSize, format, onTip, onPick, onZoomPlace }, ref) {
  const host_ref = useRef(null);
  const moved_ref = useRef(false);
  const describe_ref = useRef(null);
  describe_ref.current = { land: describeLand, outline: describeOutline };
  const size = use_size(host_ref);
  const [view, setView] = useState(HOME_VIEW);
  const [drag, setDrag] = useState(null);
  const [active, setActive] = useState(null);
  const land_shapes = shapes || [];
  const outline_shapes = outlines || [];

  const box = useMemo(() => (heat ? points_box(heat.raw) : bounds_of(land_shapes) || bounds_of(outline_shapes)), [heat, land_shapes, outline_shapes]);
  const fit = useMemo(() => (box && size.w > 0 && size.h > 0 ? fit_projection(box, size.w, size.h, PADDING) : null), [box, size.w, size.h]);
  const project = useMemo(() => (fit ? viewed(fit, view) : null), [fit, view]);

  useEffect(() => {
    setView(HOME_VIEW);
  }, [box]);

  useImperativeHandle(
    ref,
    () => ({
      zoom_by: (step) => setView((current) => zoomed(current, step, size.w, size.h, MAX_K)),
      reset: () => setView(HOME_VIEW),
      zoom_to: (place) => {
        if (!fit || !place || !place.box) return;
        setView(view_on(screen_box(place.box, fit.project), size.w, size.h, PLACE_PADDING, MAX_K));
      },
    }),
    [fit, size.w, size.h],
  );

  const land_paths = useMemo(() => (project ? land_shapes.map((shape) => shape_path(shape, project)) : []), [land_shapes, project]);
  const outline_paths = useMemo(() => (project ? outline_shapes.map((shape) => shape_path(shape, project)) : []), [outline_shapes, project]);
  const land = useMemo(
    () => land_shapes.map((shape, index) => ({ ...describe_ref.current.land(shape, index), d: land_paths[index] })).filter((entry) => entry.d),
    [land_shapes, land_paths, signature],
  );
  const rims = useMemo(
    () => outline_shapes.map((shape, index) => ({ ...describe_ref.current.outline(shape, index), d: outline_paths[index] })).filter((entry) => entry.d),
    [outline_shapes, outline_paths, signature],
  );

  const spots = useMemo(() => {
    if (!project) return [];
    const out = [];
    (places || []).forEach((place) => {
      if (out.length >= MAX_PLACES) return;
      const on = screen_box(place.box, project);
      const roomy = on.w >= place.needed[0] && on.h >= place.needed[1];
      if (!roomy && place.marks.length === 0) return;
      const [x, y] = project(place.point);
      out.push({ ...place, x, y, label: roomy ? place.label : "", row: mark_row(place.marks, markSize, format) });
    });
    return out;
  }, [places, project, markSize, format]);

  const dots = useMemo(() => {
    if (!heat || !project) return [];
    const top = Math.max(1, Number(heat.high) || 1);
    const by_group = new Map((heat.layers || []).map((layer) => [layer.key, layer]));
    return (heat.raw || []).map((point, index) => {
      const [x, y] = project([Number(point.lng), Number(point.lat)]);
      const share = Math.min(1, Math.max(0, (Number(point.weight) || 0) / top));
      const group = point.group === null || point.group === undefined ? "" : String(point.group);
      const layer = by_group.get(group);
      return { key: index, x, y, lat: Number(point.lat), lng: Number(point.lng), r: 3 + share * 5, color: layer ? layer.high : mix(heat.low, heat.hot, share) };
    });
  }, [heat, project]);

  const tip_at = (event, entry) => {
    if (!onTip || !host_ref.current) return;
    const rect = host_ref.current.getBoundingClientRect();
    onTip({ x: event.clientX - rect.left, y: event.clientY - rect.top, name: entry.name, asked: entry.asked, path: entry.path });
  };
  const leave = () => {
    setActive(null);
    if (onTip) onTip(null);
  };
  const on_down = (event) => {
    if (event.button !== 0) return;
    moved_ref.current = false;
    setDrag({ x: event.clientX, y: event.clientY, dx: 0, dy: 0 });
  };
  const on_move = (event) => {
    if (!drag) return;
    setDrag({ ...drag, dx: event.clientX - drag.x, dy: event.clientY - drag.y });
  };
  const on_up = () => {
    if (!drag) return;
    const moved = Math.abs(drag.dx) > DRAG_SLACK || Math.abs(drag.dy) > DRAG_SLACK;
    moved_ref.current = moved;
    if (moved) setView((current) => ({ ...current, x: current.x + drag.dx, y: current.y + drag.dy }));
    setDrag(null);
  };
  const pick = (entry) => {
    if (moved_ref.current || !onPick) return;
    onPick({ label: entry.asked });
  };
  // A dot of the heat: with every other dot within reach of it on screen,
  // the box of ground they stand on - the records of that point, or of the
  // heat it is part of.
  const pick_dot = (dot) => {
    if (moved_ref.current || !onPick) return;
    const near = dots.filter((other) => Math.abs(other.x - dot.x) <= DOT_REACH && Math.abs(other.y - dot.y) <= DOT_REACH);
    const box = near.reduce(
      (out, other) => ({ south: Math.min(out.south, other.lat), north: Math.max(out.north, other.lat), west: Math.min(out.west, other.lng), east: Math.max(out.east, other.lng) }),
      { south: dot.lat, north: dot.lat, west: dot.lng, east: dot.lng },
    );
    onPick({ kind: "geo", box: { south: box.south - GEO_SLACK, north: box.north + GEO_SLACK, west: box.west - GEO_SLACK, east: box.east + GEO_SLACK }, lat: dot.lat, lng: dot.lng, count: near.length });
  };
  const active_entry = active === null ? null : land.find((entry) => entry.key === active);

  return (
    <div ref={host_ref} className="dcs-map-canvas" style={{ cursor: drag ? "grabbing" : "grab", touchAction: "none" }}>
      {fit && (
        <svg
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          style={{ display: "block", fontFamily: FONT }}
          onPointerDown={on_down}
          onPointerMove={on_move}
          onPointerUp={on_up}
          onPointerLeave={on_up}
          onMouseLeave={leave}
        >
          <rect width={size.w} height={size.h} fill={theme.background} />
          <g transform={drag ? `translate(${drag.dx} ${drag.dy})` : undefined}>
            {rims.map((entry, index) => (
              <path key={`rim-fill-${index}`} d={entry.d} fill={entry.color} fillOpacity={0.06} stroke="none" />
            ))}
            {land.map((entry) => (
              <path
                key={entry.key}
                d={entry.d}
                fill={entry.color}
                fillOpacity={entry.answered ? 0.62 : 0.12}
                stroke={theme.line}
                strokeWidth={0.8}
                strokeOpacity={0.8}
                style={{ cursor: onPick ? "pointer" : undefined }}
                onMouseMove={(event) => {
                  setActive(entry.key);
                  tip_at(event, entry);
                }}
                onMouseLeave={leave}
                onClick={() => pick(entry)}
              />
            ))}
            {rims.map((entry, index) => (
              <path key={`rim-line-${index}`} d={entry.d} fill="none" stroke={entry.color} strokeWidth={entry.weight} strokeOpacity={0.85} pointerEvents="none" />
            ))}
            {active_entry && <path d={active_entry.d} fill="none" stroke={theme.active} strokeWidth={2.6} pointerEvents="none" />}
            {dots.map((dot) => (
              <circle
                key={dot.key}
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                fill={dot.color}
                fillOpacity={0.7}
                stroke="#FFFFFF"
                strokeWidth={0.6}
                pointerEvents={onPick ? "auto" : "none"}
                style={{ cursor: onPick ? "pointer" : undefined }}
                onClick={(event) => {
                  event.stopPropagation();
                  pick_dot(dot);
                }}
              />
            ))}
            {spots.map((spot) => (
              <g key={spot.key}>
                {spot.row.map((mark) => (
                  <g
                    key={mark.key}
                    transform={`translate(${spot.x + mark.left} ${spot.y - markSize / 2})`}
                    style={{ cursor: "pointer" }}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!moved_ref.current && onZoomPlace) onZoomPlace(spot);
                    }}
                  >
                    <rect width={mark.width} height={markSize} rx={markSize / 2} fill={mark.color} stroke="#FFFFFF" strokeWidth={1.5} />
                    <g transform={`translate(${mark.pad} ${(markSize - mark.glyph) / 2})`} pointerEvents="none">
                      <LibraryIcon icon={icon} size={mark.glyph} color={mark.ink} />
                    </g>
                    <text x={mark.pad + mark.glyph + 3} y={markSize / 2} dy="0.35em" fontSize={mark.font} fontWeight={700} fill={mark.ink} pointerEvents="none">
                      {mark.text}
                    </text>
                  </g>
                ))}
                {spot.label && (
                  <text
                    x={spot.x}
                    y={spot.row.length > 0 ? spot.y + markSize / 2 + spot.font + 2 : spot.y}
                    dy={spot.row.length > 0 ? 0 : "0.35em"}
                    textAnchor="middle"
                    fontSize={spot.font}
                    fontWeight={700}
                    fill={colors.text}
                    stroke={colors.background_solid}
                    strokeWidth={3}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    pointerEvents="none"
                  >
                    {spot.label}
                  </text>
                )}
              </g>
            ))}
          </g>
        </svg>
      )}
    </div>
  );
});

export default MapSvg;
