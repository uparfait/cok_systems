import React from "react";
import { get_field_text } from "../fieldText.js";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";

/**
 * Shape-specific CSS: a triangle is clipped from a square box, a circle is
 * a fully rounded box, a rectangle is a plain box - the same width, height,
 * fill, border and rotation controls apply to all three.
 */
function get_shape_style(shape_kind) {
  if (shape_kind === "circle") return { borderRadius: "50%" };
  if (shape_kind === "triangle") return { clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" };
  return {};
}

/**
 * A resizable, rotatable graphic (rectangle, circle or triangle) that can
 * carry a solid fill, a border, translated text, and/or a background image
 * - used for callouts, decorative dividers or simple diagrams inside a
 * form's design.
 */
export default function ShapeBlock({ field, language }) {
  const design = field.design || {};
  const text_value = get_field_text(field.text, language);
  const shape_style = get_shape_style(field.shape_kind);

  // Placed inside a Section: the section's own layout box determines this
  // shape's size, so it fills that box exactly instead of rendering at its
  // own width_px/height_px and leaving empty space around it.
  const fills_container = !!field.section_layout;

  const box_style = Object.assign(
    {
      width: fills_container ? "100%" : field.width_px || 120,
      height: fills_container ? "100%" : field.height_px || 120,
      transform: field.rotation_deg ? `rotate(${field.rotation_deg}deg)` : undefined,
      backgroundColor: field.image_url ? undefined : field.fill_color || "#056daa",
      border: design.border_enabled ? `${design.border_width || 1}px solid ${design.border_color || "#333333"}` : "none",
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      flexShrink: 0,
    },
    shape_style,
  );

  return (
    <div className="w-full flex" style={{ justifyContent: "flex-start" }}>
      <div style={box_style}>
        {field.image_url && (
          <img src={field.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
        )}
        {text_value && (
          <span
            className="text-center px-1"
            style={{
              position: "relative",
              color: design.text_color || "#FFFFFF",
              fontFamily: design.font_family || "'Montserrat', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              wordBreak: "break-word",
            }}
          >
            {text_value}
          </span>
        )}
      </div>
    </div>
  );
}
