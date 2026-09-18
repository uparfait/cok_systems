import React from "react";
import { get_field_text } from "../fieldText.js";
import DcsLinkedText from "../../components/DcsLinkedText.jsx";
import { fill_text_tokens } from "../textTokens.js";

// clamp(min, viewport-scaled, max) - the max is the size on a wide enough
// screen, the min is a sane floor on a small phone, and the vw term shrinks
// smoothly in between instead of a fixed size overflowing or wrapping
// awkwardly on a narrow viewport. A heading leads its questions, it does
// not shout over them, so even a Heading 1 stays close to the text under it.
const HEADING_SIZES = {
  1: "clamp(17px, 3.8vw, 22px)",
  2: "clamp(16px, 3.4vw, 19px)",
  3: "clamp(15px, 3.1vw, 17px)",
  4: "clamp(14px, 2.9vw, 16px)",
  5: "clamp(13px, 2.7vw, 15px)",
  6: "clamp(12px, 2.5vw, 13px)",
};

/**
 * A heading shows the text of the language the reader picked and nothing
 * else - the form's language switch is the one filter. Its text is written
 * per language in Field Settings; the builder canvas only previews it (raw,
 * with any {{field_id}} tokens still visible), the live form fills tokens
 * from the current answers.
 */
export default function HeaderBlock({ field, language, mode, allValues }) {
  const is_builder = mode === "builder";
  const level = field.level || 2;
  const HeadingTag = `h${level}`;
  const design = field.design || {};
  const text_value = get_field_text(field.label, language);
  const text_links = (field.text_links && field.text_links[language]) || [];
  const live = is_builder ? { text: text_value, links: text_links } : fill_text_tokens(text_value, text_links, allValues);

  return React.createElement(
    HeadingTag,
    {
      className: is_builder && !text_value ? "opacity-50" : undefined,
      style: {
        fontFamily: design.font_family || "'Montserrat', sans-serif",
        fontWeight: 700,
        color: design.text_color || "#333333",
        fontSize: HEADING_SIZES[level],
        whiteSpace: "pre-wrap",
      },
    },
    <DcsLinkedText key="linked" text={live.text} links={live.links} />,
  );
}
