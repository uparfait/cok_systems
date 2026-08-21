import React from "react";

/**
 * Self-drawn: a shield (the access gate) with granted people linked in and
 * one figure kept outside it - the plain allowlist model Access Control
 * actually implements, not a generic padlock stock image.
 */
export default function AccessControlIllustration() {
  return (
    <svg viewBox="0 0 400 300" width="100%" height="100%" role="img" aria-hidden="true">
      <ellipse cx="200" cy="270" rx="130" ry="16" fill="#056daa" opacity="0.08" />

      <g className="dcs-home-float">
        <path
          d="M200 55l70 26v55c0 55-30 90-70 108-40-18-70-53-70-108V81z"
          fill="#E8F2FA"
          stroke="#056daa"
          strokeWidth="2.5"
        />
        <path d="M175 150l18 18 32-38" stroke="#4CAF50" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <g className="dcs-home-float" style={{ animationDelay: "0.3s" }}>
        <circle cx="90" cy="110" r="20" fill="#FFFFFF" stroke="#4CAF50" strokeWidth="2.5" />
        <circle cx="90" cy="103" r="7" fill="#4CAF50" />
        <path d="M78 118c2-8 8-10 12-10s10 2 12 10" stroke="#4CAF50" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <line x1="112" y1="115" x2="140" y2="130" stroke="#4CAF50" strokeWidth="2" strokeDasharray="4 4" opacity="0.7" />
      </g>

      <g className="dcs-home-float" style={{ animationDelay: "0.15s" }}>
        <circle cx="100" cy="190" r="20" fill="#FFFFFF" stroke="#4CAF50" strokeWidth="2.5" />
        <circle cx="100" cy="183" r="7" fill="#4CAF50" />
        <path d="M88 198c2-8 8-10 12-10s10 2 12 10" stroke="#4CAF50" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <line x1="120" y1="187" x2="145" y2="175" stroke="#4CAF50" strokeWidth="2" strokeDasharray="4 4" opacity="0.7" />
      </g>

      <g className="dcs-home-float" style={{ animationDelay: "0.55s" }}>
        <circle cx="320" cy="150" r="20" fill="#F7F9FB" stroke="#9E9E9E" strokeWidth="2.5" />
        <circle cx="320" cy="143" r="7" fill="#9E9E9E" />
        <path d="M308 158c2-8 8-10 12-10s10 2 12 10" stroke="#9E9E9E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <line x1="278" y1="150" x2="300" y2="150" stroke="#E74C3C" strokeWidth="3" strokeLinecap="round" />
        <line x1="285" y1="143" x2="285" y2="157" stroke="#E74C3C" strokeWidth="3" strokeLinecap="round" transform="rotate(45 285 150)" />
      </g>
    </svg>
  );
}
