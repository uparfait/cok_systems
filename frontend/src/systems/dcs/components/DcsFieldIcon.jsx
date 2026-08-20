import React from "react";

const ICON_SHELL_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const FIELD_ICON_PATHS = {
  paragraph: (
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="11" x2="20" y2="11" />
      <line x1="4" y1="16" x2="14" y2="16" />
    </>
  ),
  header: (
    <>
      <line x1="5" y1="5" x2="5" y2="19" />
      <line x1="13" y1="5" x2="13" y2="19" />
      <line x1="5" y1="12" x2="13" y2="12" />
      <line x1="17" y1="8" x2="20" y2="8" />
      <line x1="17" y1="12" x2="20" y2="12" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
    </>
  ),
  image_block: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="0" />
      <circle cx="9" cy="10" r="2" />
      <path d="M3 17l5-5 4 4 3-3 5 5" />
    </>
  ),
  horizontal_line: <line x1="3" y1="12" x2="21" y2="12" strokeWidth="3" />,
  text: (
    <>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="12" y2="17" />
    </>
  ),
  number: (
    <>
      <line x1="9" y1="4" x2="7" y2="20" />
      <line x1="17" y1="4" x2="15" y2="20" />
      <line x1="5" y1="9" x2="21" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="0" />
      <path d="M3 6l9 7 9-7" />
    </>
  ),
  url: (
    <>
      <path d="M9 15l6-6" />
      <path d="M13 5l1.5-1.5a3.5 3.5 0 015 5L18 10" />
      <path d="M11 14l-1.5 1.5a3.5 3.5 0 01-5-5L6 9" />
    </>
  ),
  phone: (
    <path d="M6 3h3l1 5-2 1.5a10 10 0 006 6L15.5 14l5 1v3a2 2 0 01-2 2A16 16 0 014 6a2 2 0 012-3z" />
  ),
  single_select: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </>
  ),
  multi_select: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="0" />
      <path d="M8 12l3 3 6-6" />
    </>
  ),
  likert_scale: (
    <>
      <line x1="3" y1="12" x2="21" y2="12" />
      <circle cx="7" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="17" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  ranking: (
    <>
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4.5" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  date: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="0" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
    </>
  ),
  time: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l4 2" />
    </>
  ),
  date_time: (
    <>
      <rect x="3" y="5" width="14" height="15" rx="0" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <circle cx="18" cy="17" r="4.5" />
      <path d="M18 15v2l1.3 0.8" />
    </>
  ),
  duration: (
    <>
      <path d="M8 3h8" />
      <path d="M8 21h8" />
      <path d="M8 3a6 8 0 000 18" />
      <path d="M16 3a6 8 0 010 18" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="0" />
      <circle cx="9" cy="10" r="2" />
      <path d="M3 17l5-5 4 4 3-3 5 5" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="5" width="13" height="14" rx="0" />
      <path d="M16 10l5-3v10l-5-3z" />
    </>
  ),
  audio: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0014 0" />
      <line x1="12" y1="18" x2="12" y2="21" />
    </>
  ),
  file_upload: (
    <>
      <path d="M12 4v11" />
      <path d="M8 8l4-4 4 4" />
      <path d="M5 15v4h14v-4" />
    </>
  ),
  signature: (
    <>
      <path d="M3 18c3-6 4-10 6-10s2 8 4 8 2-6 4-6 2 3 4 3" />
      <line x1="3" y1="21" x2="21" y2="21" />
    </>
  ),
  group: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="0" />
      <rect x="13" y="3" width="8" height="8" rx="0" />
      <rect x="3" y="13" width="8" height="8" rx="0" />
      <rect x="13" y="13" width="8" height="8" rx="0" />
    </>
  ),
  section: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="0" strokeDasharray="3 2" />
      <rect x="6" y="8" width="5" height="8" rx="0" />
      <rect x="13" y="8" width="5" height="4" rx="0" />
    </>
  ),
  hidden: (
    <>
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
      <circle cx="12" cy="12" r="2.5" />
      <line x1="4" y1="20" x2="20" y2="4" />
    </>
  ),
  cascading_select: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M6 8.5V12h12V8.5" />
      <line x1="12" y1="12" x2="12" y2="15.5" />
    </>
  ),
  select_group: (
    <>
      <rect x="3" y="6" width="18" height="5" rx="0" />
      <rect x="3" y="13" width="18" height="5" rx="0" />
      <path d="M17 8l1.5 1.5L20 8" />
      <path d="M17 15l1.5 1.5L20 15" />
    </>
  ),
};

/**
 * Custom inline SVG icon for a given field type. Every field type in the
 * registry has a distinct, hand-drawn glyph here - no external icon library
 * is used for the data-collection field set.
 */
export default function DcsFieldIcon({ type, className, size }) {
  const dimension = size || 20;
  return (
    <svg width={dimension} height={dimension} className={className} {...ICON_SHELL_PROPS}>
      {FIELD_ICON_PATHS[type] || <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}
