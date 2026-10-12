import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const CORNER = 10;
const DOT = 4;
const PRIMARY = "#056daa";

function orthogonal_path(x1, y1, x2, y2, lane) {
  const dy = Math.abs(y2 - y1);
  if (dy < 1 || x2 <= x1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const dir = y2 > y1 ? 1 : -1;
  const xm = Math.min(Math.max(lane, x1 + 2), x2 - 2);
  const r = Math.max(0, Math.min(CORNER, dy / 2, xm - x1, x2 - xm));
  return `M ${x1} ${y1} L ${xm - r} ${y1} Q ${xm} ${y1} ${xm} ${y1 + dir * r} L ${xm} ${y2 - dir * r} Q ${xm} ${y2} ${xm + r} ${y2} L ${x2} ${y2}`;
}

function anchor(area_rect, list_rect, row_rect, side) {
  const top = Math.max(row_rect.top, list_rect.top);
  const bottom = Math.min(row_rect.bottom, list_rect.bottom);
  const y = (top <= bottom ? (top + bottom) / 2 : row_rect.top < list_rect.top ? list_rect.top : list_rect.bottom) - area_rect.top;
  const x = (side === "right" ? row_rect.right : row_rect.left) - area_rect.left;
  return { x, y, visible: top <= bottom };
}

export default function MappingLines({ areaRef, pairs, pending, hovered, onHover, onRemove, removeLabel }) {
  const [lines, setLines] = useState([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [mouse, setMouse] = useState(null);
  const frame = useRef(0);

  const measure = useCallback(() => {
    const area = areaRef.current;
    if (!area) return;
    const area_rect = area.getBoundingClientRect();
    const left_list = area.querySelector("[data-import-list='headers']");
    const right_list = area.querySelector("[data-import-list='targets']");
    if (!left_list || !right_list) return;
    const left_rect = left_list.getBoundingClientRect();
    const right_rect = right_list.getBoundingClientRect();
    const gap_left = left_rect.right - area_rect.left;
    const gap_right = right_rect.left - area_rect.left;
    const lanes = Math.max(1, Math.floor((gap_right - gap_left - 16) / 8));
    const next = pairs
      .map((pair, index) => {
        const header = area.querySelector(`[data-import-header='${pair.column}']`);
        const target = area.querySelector(`[data-import-target='${pair.key}']`);
        if (!header || !target) return null;
        const from = anchor(area_rect, left_rect, header.getBoundingClientRect(), "right");
        const to = anchor(area_rect, right_rect, target.getBoundingClientRect(), "left");
        const lane = gap_left + 8 + (index % lanes) * 8;
        return Object.assign({}, pair, { from, to, lane, path: orthogonal_path(from.x, from.y, to.x, to.y, lane) });
      })
      .filter(Boolean);
    setLines(next);
    setSize({ width: area_rect.width, height: area_rect.height });
  }, [areaRef, pairs]);

  const schedule = useCallback(() => {
    if (frame.current) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0;
      measure();
    });
  }, [measure]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return undefined;
    area.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    if (observer) {
      observer.observe(area);
      area.querySelectorAll("[data-import-list]").forEach((list) => observer.observe(list));
    }
    return () => {
      area.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (observer) observer.disconnect();
      if (frame.current) window.cancelAnimationFrame(frame.current);
    };
  }, [areaRef, schedule]);

  useEffect(() => {
    const area = areaRef.current;
    if (!area || !pending) {
      setMouse(null);
      return undefined;
    }
    const on_move = (event) => {
      const rect = area.getBoundingClientRect();
      setMouse({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    area.addEventListener("mousemove", on_move);
    return () => area.removeEventListener("mousemove", on_move);
  }, [areaRef, pending]);

  const pending_path = () => {
    const area = areaRef.current;
    if (!area || !pending || !mouse) return null;
    const area_rect = area.getBoundingClientRect();
    if (pending.kind === "header") {
      const list = area.querySelector("[data-import-list='headers']");
      const row = area.querySelector(`[data-import-header='${pending.column}']`);
      if (!list || !row) return null;
      const from = anchor(area_rect, list.getBoundingClientRect(), row.getBoundingClientRect(), "right");
      return orthogonal_path(from.x, from.y, Math.max(mouse.x, from.x + 4), mouse.y, from.x + 16);
    }
    const list = area.querySelector("[data-import-list='targets']");
    const row = area.querySelector(`[data-import-target='${pending.key}']`);
    if (!list || !row) return null;
    const to = anchor(area_rect, list.getBoundingClientRect(), row.getBoundingClientRect(), "left");
    return orthogonal_path(Math.min(mouse.x, to.x - 4), mouse.y, to.x, to.y, to.x - 16);
  };

  const pending_d = pending_path();

  return (
    <svg className="absolute inset-0" width={size.width || "100%"} height={size.height || "100%"} style={{ pointerEvents: "none", overflow: "visible" }} aria-hidden="true">
      {lines.map((line) => {
        const is_hot = hovered === line.key;
        const mid_y = (line.from.y + line.to.y) / 2;
        return (
          <g key={line.key} onMouseEnter={() => onHover(line.key)} onMouseLeave={() => onHover(null)} style={{ opacity: hovered && !is_hot ? 0.35 : 1, transition: "opacity 0.15s ease" }}>
            <path d={line.path} fill="none" stroke="transparent" strokeWidth="14" style={{ pointerEvents: "stroke", cursor: "pointer" }} onClick={() => onRemove(line.key)} />
            <path d={line.path} fill="none" stroke={line.color} strokeWidth={is_hot ? 3 : 2} strokeLinecap="round" />
            <circle cx={line.from.x} cy={line.from.y} r={DOT} fill={line.color} />
            <circle cx={line.to.x} cy={line.to.y} r={DOT + 1} fill={line.color} />
            <g transform={`translate(${line.lane}, ${mid_y})`} style={{ pointerEvents: "all", cursor: "pointer" }} onClick={() => onRemove(line.key)}>
              <title>{removeLabel}</title>
              <circle r="8" fill="#FFFFFF" stroke={line.color} strokeWidth={is_hot ? 2 : 1.5} />
              <line x1="-3" y1="-3" x2="3" y2="3" stroke={line.color} strokeWidth="1.8" strokeLinecap="round" />
              <line x1="3" y1="-3" x2="-3" y2="3" stroke={line.color} strokeWidth="1.8" strokeLinecap="round" />
            </g>
          </g>
        );
      })}
      {pending_d ? <path d={pending_d} fill="none" stroke={PRIMARY} strokeWidth="2" strokeDasharray="6 5" strokeLinecap="round" /> : null}
    </svg>
  );
}
