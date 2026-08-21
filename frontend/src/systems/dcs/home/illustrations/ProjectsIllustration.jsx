import React from "react";

/**
 * Self-drawn: a stack of project "folders" (one per department color) with
 * a plus badge for creating a new one - the whole hierarchy the Projects
 * feature actually manages, distilled into shapes instead of literal
 * photography.
 */
export default function ProjectsIllustration() {
  return (
    <svg viewBox="0 0 400 300" width="100%" height="100%" role="img" aria-hidden="true">
      <ellipse cx="200" cy="255" rx="140" ry="18" fill="#056daa" opacity="0.08" />

      <g className="dcs-home-float" style={{ animationDelay: "0.4s" }}>
        <rect x="70" y="150" width="150" height="100" rx="10" fill="#E8F2FA" stroke="#056daa" strokeWidth="2" />
        <rect x="70" y="134" width="70" height="24" rx="8" fill="#E8F2FA" stroke="#056daa" strokeWidth="2" />
      </g>

      <g className="dcs-home-float" style={{ animationDelay: "0.15s" }}>
        <rect x="120" y="110" width="170" height="115" rx="12" fill="#FFFFFF" stroke="#056daa" strokeWidth="2.5" />
        <rect x="120" y="92" width="80" height="26" rx="9" fill="#FFFFFF" stroke="#056daa" strokeWidth="2.5" />
        <line x1="140" y1="150" x2="245" y2="150" stroke="#056daa" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
        <line x1="140" y1="170" x2="270" y2="170" stroke="#056daa" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
        <line x1="140" y1="190" x2="225" y2="190" stroke="#056daa" strokeWidth="3" strokeLinecap="round" opacity="0.25" />
        <circle cx="160" cy="150" r="4" fill="#4CAF50" />
        <circle cx="160" cy="170" r="4" fill="#F5A623" />
        <circle cx="160" cy="190" r="4" fill="#056daa" />
      </g>

      <g>
        <circle cx="300" cy="95" r="26" fill="#056daa" className="dcs-home-pulse-ring" />
        <circle cx="300" cy="95" r="26" fill="#056daa" />
        <line x1="290" y1="95" x2="310" y2="95" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
        <line x1="300" y1="85" x2="300" y2="105" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}
