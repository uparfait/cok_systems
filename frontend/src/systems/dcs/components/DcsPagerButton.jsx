import React from "react";

export default function DcsPagerButton({ direction, onClick, disabled, title }) {
  const points = direction === "previous" ? "15 5 8 12 15 19" : "9 5 16 12 9 19";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="dcs-pager-button"
      style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#056daa" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points={points} />
      </svg>
    </button>
  );
}
