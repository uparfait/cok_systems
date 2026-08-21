import React from "react";

/**
 * Self-drawn toggle icon for the projects sidebar - two bars, the top one
 * long and the bottom one short, rather than a generic three-line
 * hamburger (which already means something else - the main app nav).
 * Mirrored when the sidebar is open, so the icon itself visibly flips to
 * signal the state change, not just the button's own position.
 */
export default function DcsSidebarToggleIcon({ color, flipped }) {
  return (
    <svg
      width="18"
      height="14"
      viewBox="0 0 18 14"
      fill="none"
      style={{ transform: flipped ? "scaleX(-1)" : "none", transition: "transform 0.32s ease" }}
    >
      <line x1="1" y1="2" x2="17" y2="2" stroke={color || "#056daa"} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="1" y1="11" x2="9" y2="11" stroke={color || "#056daa"} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
