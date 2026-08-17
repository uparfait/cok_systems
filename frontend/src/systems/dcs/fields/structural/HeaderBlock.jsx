import React from "react";
import { get_field_text } from "../fieldText.js";

const HEADING_SIZES = { 1: 28, 2: 24, 3: 21, 4: 18, 5: 16, 6: 14 };

/**
 * A section heading at a chosen level (H1 to H6), authored as a plain
 * multi-line text area like every other text block, so Enter always just
 * breaks the line.
 */
export default function HeaderBlock({ field, language, mode, onFieldChange }) {
  const is_builder = mode === "builder";
  const level = field.level || 2;
  const text_value = get_field_text(field.label, language);
  const HeadingTag = `h${level}`;
  const design = field.design || {};
  const fills_container = !!field.section_layout;

  if (!is_builder) {
    return React.createElement(
      HeadingTag,
      {
        style: {
          fontFamily: design.font_family || "'Montserrat', sans-serif",
          fontWeight: 700,
          color: design.text_color || "#333333",
          fontSize: HEADING_SIZES[level],
          whiteSpace: "pre-wrap",
        },
      },
      text_value,
    );
  }

  return (
    <textarea
      className="cok-auth-input w-full py-2"
      style={fills_container ? { fontWeight: 700, fontSize: HEADING_SIZES[level], height: "100%", resize: "none" } : { fontWeight: 700, fontSize: HEADING_SIZES[level], resize: "none" }}
      rows={fills_container ? undefined : 2}
      value={text_value}
      onChange={(event) => {
        if (!onFieldChange) return;
        const next_label = Object.assign({}, field.label, { [language]: event.target.value });
        onFieldChange(Object.assign({}, field, { label: next_label }));
      }}
    />
  );
}
