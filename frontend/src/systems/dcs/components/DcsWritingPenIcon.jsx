import React, { useEffect, useRef } from "react";

const NS = "http://www.w3.org/2000/svg";
const WRITE = 3500;
const TRAVEL = 280;
const LINES = [[34, 78, 50], [34, 74, 62], [34, 62, 74]];
const CROSS_LEN = Math.hypot(32, 32);

function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cursive(x0, x1, y, rng) {
  let d = "M " + x0 + " " + y;
  let x = x0;
  while (x < x1 - 1.5) {
    const w = 3.2 + rng() * 2.2;
    const nx = Math.min(x + w, x1);
    const up = 3.4 + rng() * 4.6;
    const dy = (rng() - 0.5) * 1.1;
    d += ` C ${(x + w * 0.18).toFixed(2)} ${(y - up).toFixed(2)} ${(nx - w * 0.18).toFixed(2)} ${(y - up * 0.88).toFixed(2)} ${nx.toFixed(2)} ${(y + dy).toFixed(2)}`;
    x = nx;
    if (rng() < 0.24 && x < x1 - 4.5) {
      const nx2 = Math.min(x + 2.8 + rng() * 2, x1);
      d += ` C ${(x + 0.9).toFixed(2)} ${(y + 2.4 + rng() * 2).toFixed(2)} ${(nx2 - 0.9).toFixed(2)} ${(y + 2.2).toFixed(2)} ${nx2.toFixed(2)} ${y}`;
      x = nx2;
    }
  }
  return d;
}

const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const inOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const inOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const outCubic = (t) => 1 - Math.pow(1 - t, 3);

function run_animation(refs) {
  const { ink, cross, c1, c2, pen } = refs;
  const rng = mulberry32(20260921);
  const segs = LINES.map((l) => {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", cursive(l[0], l[1], l[2], rng));
    ink.appendChild(p);
    const len = p.getTotalLength();
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = len;
    return { el: p, len };
  });
  const totalLen = segs.reduce((s, x) => s + x.len, 0);
  let cursor = 0;
  segs.forEach((s, i) => {
    s.dur = (WRITE * s.len) / totalLen;
    s.start = cursor;
    cursor += s.dur + (i < segs.length - 1 ? TRAVEL : 0);
  });
  const writeEnd = cursor;
  const pauseEnd = writeEnd + 380;
  const exitEnd = pauseEnd + 560;
  const crossEnd = exitEnd + 760;
  const floatEnd = crossEnd + 2700;
  const fadeEnd = floatEnd + 680;
  const LOOP = fadeEnd + 320;
  [c1, c2].forEach((l) => {
    l.style.strokeDasharray = CROSS_LEN;
    l.style.strokeDashoffset = CROSS_LEN;
  });

  function render(t) {
    segs.forEach((s) => {
      const off = t < s.start ? s.len : t < s.start + s.dur ? s.len * (1 - inOutQuad((t - s.start) / s.dur)) : 0;
      s.el.style.strokeDashoffset = off;
    });
    let px = 34;
    let py = 50;
    let lift = 0;
    let alpha = 1;
    const last = segs[segs.length - 1];
    if (t < writeEnd) {
      let placed = false;
      for (let i = 0; i < segs.length; i += 1) {
        const s = segs[i];
        if (t < s.start + s.dur) {
          const pt = s.el.getPointAtLength(inOutQuad(clamp((t - s.start) / s.dur)) * s.len);
          px = pt.x;
          py = pt.y;
          placed = true;
          break;
        }
        if (i < segs.length - 1 && t < segs[i + 1].start) {
          const u = clamp((t - (s.start + s.dur)) / TRAVEL);
          const a = s.el.getPointAtLength(s.len);
          const b = segs[i + 1].el.getPointAtLength(0);
          const e = inOutCubic(u);
          px = a.x + (b.x - a.x) * e;
          py = a.y + (b.y - a.y) * e;
          lift = -6 * Math.sin(Math.PI * u);
          placed = true;
          break;
        }
      }
      if (!placed) {
        const pt = last.el.getPointAtLength(last.len);
        px = pt.x;
        py = pt.y;
      }
      lift += Math.sin(t / 42) * 0.22;
    } else {
      const pt = last.el.getPointAtLength(last.len);
      px = pt.x;
      py = pt.y;
      if (t < pauseEnd) {
        lift = -2 * inOutCubic(clamp((t - writeEnd) / (pauseEnd - writeEnd)));
      } else if (t < exitEnd) {
        const e = inOutCubic(clamp((t - pauseEnd) / (exitEnd - pauseEnd)));
        px += 26 * e;
        py += 34 * e;
        lift = -9 * e;
        alpha = 1 - e;
      } else {
        alpha = 0;
      }
    }
    pen.setAttribute("transform", "translate(" + px.toFixed(2) + "," + (py + lift).toFixed(2) + ")");
    pen.style.opacity = alpha;
    c1.style.strokeDashoffset = CROSS_LEN * (1 - outCubic(clamp((t - exitEnd) / 420)));
    c2.style.strokeDashoffset = CROSS_LEN * (1 - outCubic(clamp((t - (exitEnd + 300)) / 420)));
    cross.classList.toggle("active", t >= exitEnd && t < fadeEnd);
    const fade = t > floatEnd ? 1 - inOutCubic(clamp((t - floatEnd) / (fadeEnd - floatEnd))) : 1;
    ink.style.opacity = fade;
    cross.style.opacity = fade;
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    render(crossEnd + 40);
    return () => {};
  }
  let t0 = null;
  let frame_id = 0;
  const frame = (ts) => {
    if (t0 === null) t0 = ts;
    render((ts - t0) % LOOP);
    frame_id = window.requestAnimationFrame(frame);
  };
  frame_id = window.requestAnimationFrame(frame);
  return () => window.cancelAnimationFrame(frame_id);
}

export default function DcsWritingPenIcon({ size }) {
  const ink_ref = useRef(null);
  const cross_ref = useRef(null);
  const c1_ref = useRef(null);
  const c2_ref = useRef(null);
  const pen_ref = useRef(null);

  useEffect(() => {
    const ink = ink_ref.current;
    const stop = run_animation({ ink, cross: cross_ref.current, c1: c1_ref.current, c2: c2_ref.current, pen: pen_ref.current });
    return () => {
      stop();
      while (ink && ink.firstChild) ink.removeChild(ink.firstChild);
    };
  }, []);

  const dimension = size || "clamp(30px, 18vmin, 100px)";

  return (
    <span className="dcs-pen-icon" style={{ width: dimension, height: dimension, display: "block" }}>
      <svg viewBox="18 14 84 88" role="img" aria-label="Loading" style={{ display: "block", width: "100%", height: "100%" }}>
        <g>
          <rect x="26" y="26" width="60" height="68" rx="3" fill="#FFFFFF" stroke="#e2ebf2" strokeWidth="1" />
          <g stroke="#d3e7f5" strokeWidth="1" strokeLinecap="round">
            <line x1="31" y1="50" x2="81" y2="50" />
            <line x1="31" y1="62" x2="81" y2="62" />
            <line x1="31" y1="74" x2="81" y2="74" />
            <line x1="31" y1="86" x2="81" y2="86" />
          </g>
          <g ref={ink_ref} className="dcs-pen-ink" />
          <g ref={cross_ref} className="dcs-pen-cross" transform="translate(56,60)">
            <g className="dcs-pen-floater">
              <line ref={c1_ref} className="dcs-pen-cross-stroke" x1="-16" y1="-16" x2="16" y2="16" />
              <line ref={c2_ref} className="dcs-pen-cross-stroke" x1="16" y1="-16" x2="-16" y2="16" />
            </g>
          </g>
          <g ref={pen_ref}>
            <g transform="rotate(34)">
              <path fill="#056daa" d="M -1.6 -6 L 0 0 L 1.6 -6 Z" />
              <rect fill="#056daa" x="-2" y="-29" width="4" height="24" rx="1.6" />
              <rect fill="#056daa" x="-3" y="-33.6" width="6" height="5.4" rx="2.2" />
            </g>
          </g>
        </g>
      </svg>
      <style>{`
        .dcs-pen-ink path { fill: none; stroke: #056daa; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .dcs-pen-cross-stroke { stroke: #e03131; stroke-width: 6.5; stroke-linecap: round; fill: none; }
        .dcs-pen-floater { transform-box: fill-box; transform-origin: center; }
        .dcs-pen-cross.active .dcs-pen-floater { animation: dcs-pen-bob 2.7s ease-in-out infinite alternate; }
        @keyframes dcs-pen-bob {
          from { transform: translateY(-3px) rotate(-3deg) scale(.97); }
          to { transform: translateY(3px) rotate(3deg) scale(1.03); }
        }
        @media (prefers-reduced-motion: reduce) { .dcs-pen-cross.active .dcs-pen-floater { animation: none; } }
      `}</style>
    </span>
  );
}
