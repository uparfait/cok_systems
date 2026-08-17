import React from "react";

/**
 * A plain horizontal rule used to visually separate sections of a form.
 * Its thickness comes from the field itself; color comes from the shared
 * design settings. Width and horizontal position are already applied by
 * the renderer's own design wrapper, so this just fills that box.
 */
export default function HorizontalLineBlock({ field }) {
  const design = field.design || {};

  return (
    <div
      style={{
        width: "100%",
        height: field.thickness_px || 2,
        backgroundColor: design.border_color || "#E0E0E0",
      }}
    />
  );
}
