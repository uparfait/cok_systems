import React from "react";

const SHELL = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

/** A key: the record tracking (key index) setting. */
export function KeyIcon({ size }) {
  return (
    <svg width={size || 16} height={size || 16} {...SHELL} aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.7 12.3L21 2" />
      <path d="M15 8l3 3" />
      <path d="M18 5l3 3" />
    </svg>
  );
}

/** A magnifier: search the records holding a key value. */
export function SearchIcon({ size }) {
  return (
    <svg width={size || 16} height={size || 16} {...SHELL} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/** A clock with an arrow: the change history of a record. */
export function HistoryIcon({ size }) {
  return (
    <svg width={size || 16} height={size || 16} {...SHELL} aria-hidden="true">
      <path d="M3 12a9 9 0 109-9 9 9 0 00-7.5 4" />
      <polyline points="3 3 3 8 8 8" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  );
}

/** A padlock: a field the loaded record does not let this person change. */
export function LockIcon({ size }) {
  return (
    <svg width={size || 12} height={size || 12} {...SHELL} aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="1" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}
