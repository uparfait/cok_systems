import React from "react";

/**
 * The little line drawings beside each link of the form workspace panel.
 * One flat map from a link key to its glyph, drawn at whatever size and
 * colour the row asks for, so the panel itself never carries any path
 * data of its own.
 */

const base = (size, color) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color,
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

const GLYPHS = {
  table: (props) => (
    <svg {...props}>
      <rect x="3" y="4" width="18" height="16" />
      <line x1="3" y1="9.5" x2="21" y2="9.5" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="10" y1="4" x2="10" y2="20" />
    </svg>
  ),
  dashboard: (props) => (
    <svg {...props}>
      <rect x="3" y="3" width="7.5" height="9" />
      <rect x="13.5" y="3" width="7.5" height="5.5" />
      <rect x="3" y="15" width="7.5" height="6" />
      <rect x="13.5" y="11.5" width="7.5" height="9.5" />
    </svg>
  ),
  gallery: (props) => (
    <svg {...props}>
      <rect x="3" y="4" width="18" height="16" />
      <circle cx="8.5" cy="9.5" r="1.8" />
      <path d="M21 16l-5-5-5.5 5.5L8 14l-5 5" />
    </svg>
  ),
  downloads: (props) => (
    <svg {...props}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  share: (props) => (
    <svg {...props}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
      <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
    </svg>
  ),
  "test-data": (props) => (
    <svg {...props}>
      <path d="M9 3v6.5L4.5 18a2 2 0 001.8 3h11.4a2 2 0 001.8-3L15 9.5V3" />
      <line x1="8" y1="3" x2="16" y2="3" />
      <line x1="7" y1="14.5" x2="17" y2="14.5" />
    </svg>
  ),
  versions: (props) => (
    <svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  ),
  ownership: (props) => (
    <svg {...props}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  approvals: (props) => (
    <svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8.2 12.2 11 15 16 9.5" />
    </svg>
  ),
  overview: (props) => (
    <svg {...props}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="15" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  ),
  settings: (props) => (
    <svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" />
    </svg>
  ),
};

export default function DcsFormSidebarIcon({ name, size, color }) {
  const draw = GLYPHS[name];
  if (!draw) return null;
  return draw(base(size || 16, color || "#056daa"));
}
