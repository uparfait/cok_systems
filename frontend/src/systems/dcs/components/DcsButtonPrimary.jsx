import React from "react";

/**
 * Primary action button, matching the shared cok-btn-primary design rule.
 */
export default function DcsButtonPrimary({ children, onClick, disabled, type, className, style }) {
  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      className={`cok-btn-primary ${className || ""}`}
      style={Object.assign({ opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : "pointer" }, style)}
    >
      {children}
    </button>
  );
}
