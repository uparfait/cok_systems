import React from "react";
import { get_field_text } from "../fieldText.js";

const HEADING_SIZES = { 1: 28, 2: 24, 3: 21, 4: 18, 5: 16, 6: 14 };

/**
 * A section heading at a chosen level (H1 to H6). Every form must carry a
 * header block before anything else, authored here just like any other
 * component.
 */
export default function HeaderBlock({ field, language, mode, onFieldChange }) {
  const is_builder = mode === "builder";
  const level = field.level || 2;
  const text_value = get_field_text(field.label, language);
  const HeadingTag = `h${level}`;

  if (!is_builder) {
    return React.createElement(
      HeadingTag,
      { style: { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, color: "#333333", fontSize: HEADING_SIZES[level] } },
      text_value,
    );
  }

  return (
    <input
      className="cok-auth-input w-full py-2"
      style={{ fontWeight: 700, fontSize: HEADING_SIZES[level] }}
      value={text_value}
      onChange={(event) => {
        if (!onFieldChange) return;
        const next_label = Object.assign({}, field.label, { [language]: event.target.value });
        onFieldChange(Object.assign({}, field, { label: next_label }));
      }}
    />
  );
}
