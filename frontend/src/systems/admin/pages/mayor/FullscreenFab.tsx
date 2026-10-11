import React, { useEffect, useRef, useState } from 'react';
import { FiMaximize2, FiMinimize2 } from 'react-icons/fi';

const SIZE = 44;
const STORAGE_KEY = 'cok-overview-fullscreen-fab';
const DRAG_THRESHOLD = 6;

interface Point {
  x: number;
  y: number;
}

const clamp = (p: Point): Point => ({
  x: Math.min(Math.max(8, p.x), Math.max(8, window.innerWidth - SIZE - 8)),
  y: Math.min(Math.max(8, p.y), Math.max(8, window.innerHeight - SIZE - 8)),
});

const readSaved = (): Point | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Point;
    return Number.isFinite(p.x) && Number.isFinite(p.y) ? clamp(p) : null;
  } catch {
    return null;
  }
};

interface FullscreenFabProps {
  active: boolean;
  onToggle: () => void;
}

const FullscreenFab: React.FC<FullscreenFabProps> = ({ active, onToggle }) => {
  const [pos, setPos] = useState<Point>(() => readSaved() || { x: window.innerWidth - SIZE - 16, y: 84 });
  const drag = useRef<{ start: Point; origin: Point; moved: boolean } | null>(null);

  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    drag.current = { start: { x: e.clientX, y: e.clientY }, origin: pos, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.start.x;
    const dy = e.clientY - d.start.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    setPos(clamp({ x: d.origin.x + dx, y: d.origin.y + dy }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d) return;
    if (d.moved) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } catch {
        return;
      }
      return;
    }
    onToggle();
  };

  const Icon = active ? FiMinimize2 : FiMaximize2;

  return (
    <button
      type="button"
      aria-label={active ? 'Exit full screen' : 'View in full screen'}
      title={active ? 'Exit full screen (drag to move)' : 'Full screen (drag to move)'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null; }}
      className="fixed z-40 flex items-center justify-center rounded-full bg-[#056daa] text-white shadow-lg hover:bg-[#045d94] cursor-grab active:cursor-grabbing select-none touch-none"
      style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE }}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
};

export default FullscreenFab;
