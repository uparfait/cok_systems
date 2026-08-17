import React from "react";
import { get_field_text } from "../fieldText.js";

const ALLOWED_LIST_TYPES = ["disc", "circle", "square", "decimal", "lower-roman", "upper-roman", "none"];
const ORDERED_LIST_TYPES = ["decimal", "lower-roman", "upper-roman"];

/**
 * A plain block of descriptive text - authored as an ordinary multi-line
 * text area (so Enter always just breaks the line, no rich-text editor
 * involved) and, when a list style is chosen in the Designs tab, rendered
 * with each non-empty line as its own list item.
 */
export default function ParagraphBlock({ field, language, mode, onFieldChange }) {
  const is_builder = mode === "builder";
  const content_text = get_field_text(field.content, language);
  const design = field.design || {};
  const fills_container = !!field.section_layout;

  if (!is_builder) {
    const text_style = { color: design.text_color || "#555555", fontFamily: design.font_family || undefined };

    if (ALLOWED_LIST_TYPES.includes(design.list_type) && design.list_type !== "none") {
      const lines = content_text.split("\n").filter((line) => line.trim().length > 0);
      const ListTag = ORDERED_LIST_TYPES.includes(design.list_type) ? "ol" : "ul";
      return (
        <ListTag className="text-sm pl-6" style={Object.assign({ listStyleType: design.list_type }, text_style)}>
          {lines.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ListTag>
      );
    }

    return (
      <div className="text-sm" style={Object.assign({ whiteSpace: "pre-wrap" }, text_style)}>
        {content_text}
      </div>
    );
  }

  return (
    <textarea
      className="cok-auth-input w-full py-2"
      style={fills_container ? { height: "100%", resize: "none" } : { resize: "none" }}
      rows={fills_container ? undefined : 4}
      value={content_text}
      onChange={(event) => {
        if (!onFieldChange) return;
        const next_content = Object.assign({}, field.content, { [language]: event.target.value });
        onFieldChange(Object.assign({}, field, { content: next_content }));
      }}
    />
  );
}
