import React from "react";

/**
 * Self-drawn: a browser-style panel with chart placeholders and a small
 * clock badge - deliberately sketched as "being assembled" rather than a
 * finished, data-filled dashboard, since this feature is still on the
 * roadmap and the page must never claim otherwise.
 */
export default function DashboardIllustration() {
  return (
    <svg viewBox="0 0 400 300" width="100%" height="100%" role="img" aria-hidden="true">
      <ellipse cx="200" cy="270" rx="140" ry="16" fill="#056daa" opacity="0.08" />

      <g className="dcs-home-float">
        <rect x="60" y="70" width="280" height="180" rx="14" fill="#FFFFFF" stroke="#056daa" strokeWidth="2.5" />
        <rect x="60" y="70" width="280" height="30" rx="14" fill="#E8F2FA" />
        <circle cx="80" cy="85" r="4" fill="#E74C3C" />
        <circle cx="94" cy="85" r="4" fill="#F5A623" />
        <circle cx="108" cy="85" r="4" fill="#4CAF50" />

        <rect x="80" y="120" width="70" height="90" rx="6" fill="#F7F9FB" stroke="#056daa" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.7" />
        <rect x="92" y="175" width="12" height="30" rx="2" fill="#056daa" opacity="0.35" />
        <rect x="110" y="160" width="12" height="45" rx="2" fill="#056daa" opacity="0.5" />
        <rect x="128" y="145" width="12" height="60" rx="2" fill="#056daa" opacity="0.35" />

        <rect x="165" y="120" width="155" height="90" rx="6" fill="#F7F9FB" stroke="#056daa" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.7" />
        <polyline
          points="178,190 200,165 222,180 245,140 268,155 292,125 308,150"
          fill="none"
          stroke="#4CAF50"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
        />
      </g>

      <g className="dcs-home-float" style={{ animationDelay: "0.4s" }}>
        <circle cx="330" cy="235" r="28" fill="#F5A623" className="dcs-home-pulse-ring" />
        <circle cx="330" cy="235" r="28" fill="#F5A623" />
        <circle cx="330" cy="235" r="15" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
        <line x1="330" y1="235" x2="330" y2="225" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="330" y1="235" x2="337" y2="238" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
