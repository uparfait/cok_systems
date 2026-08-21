import React from "react";

/**
 * Self-drawn: a clipboard of question types (text line, choice circles, a
 * media/upload square) with a share-link badge - the two real pillars of
 * the Forms feature, a real field builder and a public link, in one shape.
 */
export default function FormsIllustration() {
  return (
    <svg viewBox="0 0 400 300" width="100%" height="100%" role="img" aria-hidden="true">
      <ellipse cx="200" cy="270" rx="130" ry="16" fill="#056daa" opacity="0.08" />

      <g className="dcs-home-float" style={{ animationDelay: "0.2s" }}>
        <rect x="110" y="55" width="180" height="220" rx="14" fill="#FFFFFF" stroke="#056daa" strokeWidth="2.5" />
        <rect x="160" y="42" width="80" height="26" rx="8" fill="#056daa" />

        <line x1="135" y1="100" x2="220" y2="100" stroke="#333333" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        <line x1="135" y1="118" x2="265" y2="118" stroke="#9E9E9E" strokeWidth="2" strokeLinecap="round" opacity="0.5" />

        <circle cx="143" cy="150" r="7" fill="none" stroke="#056daa" strokeWidth="2.5" />
        <line x1="160" y1="150" x2="255" y2="150" stroke="#9E9E9E" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        <circle cx="143" cy="175" r="7" fill="#4CAF50" />
        <path d="M139 175l3 3 6-6" stroke="#FFFFFF" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="160" y1="175" x2="240" y2="175" stroke="#9E9E9E" strokeWidth="2" strokeLinecap="round" opacity="0.5" />

        <rect x="135" y="200" width="34" height="34" rx="6" fill="#E8F2FA" stroke="#056daa" strokeWidth="2" />
        <path d="M143 224l7-9 5 6 4-5 6 8" stroke="#056daa" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="180" y1="217" x2="255" y2="217" stroke="#9E9E9E" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      </g>

      <g className="dcs-home-float" style={{ animationDelay: "0.5s" }}>
        <circle cx="300" cy="220" r="30" fill="#FFFFFF" stroke="#056daa" strokeWidth="2.5" />
        <path
          d="M292 224a8 8 0 010-11l6-6a8 8 0 0111 11l-3 3"
          stroke="#056daa"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M308 216a8 8 0 010 11l-6 6a8 8 0 01-11-11l3-3"
          stroke="#056daa"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
