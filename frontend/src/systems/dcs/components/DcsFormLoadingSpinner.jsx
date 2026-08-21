import React from "react";

/**
 * Large, centered, text-free loading indicator shown only while the public
 * form itself is loading - the "goo" spinner effect (blur + color-matrix
 * threshold melding the two dashed strokes into one flowing shape) kept
 * exactly as designed, recolored to the system's own blue instead of the
 * original pink/orange so it still looks like part of this app.
 */
export default function DcsFormLoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F7F9FB" }}>
      <div style={{ position: "relative", width: "min(55vw, 220px)", height: "min(55vw, 220px)" }}>
        <svg width="0" height="0">
          <defs>
            <filter id="dcs-spinner-goo">
              <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10" result="thresholded" />
              <feComposite in="SourceGraphic" in2="thresholded" operator="atop" />
            </filter>
            <linearGradient id="dcs-spinner-stops">
              <stop offset="0" stopColor="#056daa" />
              <stop offset="1" stopColor="#3fb6e6" />
            </linearGradient>
            <linearGradient id="dcs-spinner-gradient" x1="40" y1="40" x2="160" y2="160" gradientUnits="userSpaceOnUse" xlinkHref="#dcs-spinner-stops" />
          </defs>
        </svg>

        <svg
          viewBox="0 0 200 200"
          style={{ position: "absolute", top: 3, left: 3, width: "100%", height: "100%", filter: "blur(5px)", opacity: 0.25 }}
        >
          <path className="dcs-spinner-arc" d="m 164,100 c 0,-35.346224 -28.65378,-64 -64,-64 -35.346224,0 -64,28.653776 -64,64 0,35.34622 28.653776,64 64,64 35.34622,0 64,-26.21502 64,-64 0,-37.784981 -26.92058,-64 -64,-64 -37.079421,0 -65.267479,26.922736 -64,64 1.267479,37.07726 26.703171,65.05317 64,64 37.29683,-1.05317 64,-64 64,-64" />
          <circle className="dcs-spinner-dot" cx="100" cy="100" r="64" />
        </svg>

        <svg viewBox="0 0 200 200" style={{ position: "relative", width: "100%", height: "100%", filter: "url(#dcs-spinner-goo)" }}>
          <path className="dcs-spinner-arc" d="m 164,100 c 0,-35.346224 -28.65378,-64 -64,-64 -35.346224,0 -64,28.653776 -64,64 0,35.34622 28.653776,64 64,64 35.34622,0 64,-26.21502 64,-64 0,-37.784981 -26.92058,-64 -64,-64 -37.079421,0 -65.267479,26.922736 -64,64 1.267479,37.07726 26.703171,65.05317 64,64 37.29683,-1.05317 64,-64 64,-64" />
          <circle className="dcs-spinner-dot" cx="100" cy="100" r="64" />
        </svg>
      </div>

      <style>{`
        .dcs-spinner-arc {
          animation: dcs-spinner-spin 10s infinite linear;
          stroke-dasharray: 180 800;
          fill: none;
          stroke: url(#dcs-spinner-gradient);
          stroke-width: 23;
          stroke-linecap: round;
        }
        .dcs-spinner-dot {
          animation: dcs-spinner-spin 3s infinite linear;
          stroke-dasharray: 26 54;
          fill: none;
          stroke: url(#dcs-spinner-gradient);
          stroke-width: 23;
          stroke-linecap: round;
        }
        @keyframes dcs-spinner-spin {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -403px; }
        }
      `}</style>
    </div>
  );
}
