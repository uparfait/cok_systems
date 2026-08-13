import React, { useEffect, useState } from "react";

/**
 * Animated checkmark that pops in on mount, used to mark a wizard step as
 * finished.
 */
export default function DcsStepCheckIcon({ size }) {
  const dimension = size || 14;
  const [is_visible, setIsVisible] = useState(false);

  useEffect(() => {
    const timeout_id = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(timeout_id);
  }, []);

  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: is_visible ? "scale(1)" : "scale(0)",
        opacity: is_visible ? 1 : 0,
        transition: "transform 0.25s ease, opacity 0.25s ease",
      }}
    >
      <polyline points="4 13 9 18 20 6" />
    </svg>
  );
}
