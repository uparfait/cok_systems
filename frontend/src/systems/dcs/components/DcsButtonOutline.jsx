import React from "react";

/**
 * Outlined secondary button, matching the shared cok-btn-outlined design rule.
 */
export default function DcsButtonOutline({ children, onClick, disabled, type, className, style }) {
  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      className={`cok-btn-outlined ${className || ""}`}
      style={Object.assign({ opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : "pointer" }, style)}
    >
      {children}
    </button>
  );
}
