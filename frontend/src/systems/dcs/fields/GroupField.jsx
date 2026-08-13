import React from "react";
import { get_field_text } from "./fieldText.js";

/**
 * Organizes related fields visually together. Rendering of each child is
 * delegated back to the caller via renderChildField, so this component
 * never needs to know about the full field type registry itself.
 */
export default function GroupField({ field, language, renderChildField }) {
  const label = get_field_text(field.label, language);

  return (
    <div className="w-full border p-3" style={{ borderColor: "#E0E0E0" }}>
      {label && (
        <p className="text-sm font-semibold mb-3" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
          {label}
        </p>
      )}
      <div className="space-y-4">
        {(field.children || []).map((child_field) => (
          <div key={child_field.id}>{renderChildField(child_field)}</div>
        ))}
      </div>
    </div>
  );
}
