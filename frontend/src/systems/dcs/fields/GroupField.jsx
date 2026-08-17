import React from "react";
import { get_field_text } from "./fieldText.js";
import { get_spacing_below_px } from "../renderer/designStyles.js";

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
      <div>
        {(field.children || []).map((child_field) => (
          <div key={child_field.id} style={{ marginBottom: get_spacing_below_px(child_field) }}>
            {renderChildField(child_field)}
          </div>
        ))}
      </div>
    </div>
  );
}
