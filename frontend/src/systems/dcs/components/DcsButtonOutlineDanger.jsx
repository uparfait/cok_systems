import React from "react";

/**
 * Outlined danger button for destructive actions (e.g. delete), matching
 * the shared cok-btn-outlined-danger design rule - stays red on hover,
 * never the primary blue an inline color override can't fight against
 * since a stylesheet's own :hover rule always wins over inline styles.
 */
export default function DcsButtonOutlineDanger({ children, onClick, disabled, type, className, style }) {
  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      className={`cok-btn-outlined-danger ${className || ""}`}
      style={Object.assign({ opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : "pointer" }, style)}
    >
      {children}
    </button>
  );
}
