import React from "react";

/**
 * "Data Collection System" as a small monogram in the header, drawn like
 * handwriting - an SVG outline of "DCS" whose stroke animates in as if
 * being written, then loops. No pathLength normalization here: browser
 * support for pathLength on a <text> element (as opposed to a <path>) is
 * unreliable, which silently made the very first version of this
 * invisible - stroke-dasharray/-dashoffset below instead use a fixed unit
 * count tuned to roughly match "DCS" at this font/size, same as the
 * reference technique this is based on.
 */
export default function DcsLogoMark({ title }) {
  return (
    <svg className="dcs-logo-mark" viewBox="0 0 80 36" width="64" height="30" role="img" aria-label={title}>
      <title>{title}</title>
      <text x="2" y="27" className="dcs-logo-mark-write" fontFamily="'Montserrat', sans-serif" fontWeight="800" fontSize="26">
        DCS
      </text>
    </svg>
  );
}
