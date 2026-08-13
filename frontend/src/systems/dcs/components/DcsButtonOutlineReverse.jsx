import React from "react";

/**
 * Reversed outline button used for close/dismiss actions on a colored
 * header, matching the shared cok-btn-outlined-reverse design rule.
 */
export default function DcsButtonOutlineReverse({ children, onClick, disabled, type, className }) {
  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      className={`cok-btn-outlined-reverse ${className || ""}`}
      style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      {children}
    </button>
  );
}
