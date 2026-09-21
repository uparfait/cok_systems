import React from "react";
import DcsWritingPenIcon from "./DcsWritingPenIcon.jsx";

/**
 * Large, centered, text-free loading indicator shown only while the public
 * form itself is loading: the writing-pen icon (a pen writes on a sheet,
 * then a red cross appears and floats) in the system's own blue.
 */
export default function DcsFormLoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F7F9FB" }}>
      <DcsWritingPenIcon size="clamp(120px, 45vmin, 220px)" />
    </div>
  );
}
