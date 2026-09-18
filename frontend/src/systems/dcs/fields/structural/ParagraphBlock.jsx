import React from "react";
import { get_field_text } from "../fieldText.js";
import DcsLinkedText from "../../components/DcsLinkedText.jsx";
import { split_lines_with_offsets, shift_links_to_range } from "../textLinkSegments.js";
import { fill_text_tokens } from "../textTokens.js";

const ALLOWED_LIST_TYPES = ["disc", "circle", "square", "decimal", "lower-roman", "upper-roman", "none"];
const ORDERED_LIST_TYPES = ["decimal", "lower-roman", "upper-roman"];

/**
 * A paragraph shows the text of the language the reader picked and nothing
 * else - the form's language switch is the one filter. Its text is written
 * per language in Field Settings; the builder canvas only previews it (raw,
 * with any {{field_id}} tokens still visible), the live form fills tokens
 * from the current answers.
 */
export default function ParagraphBlock({ field, language, mode, allValues }) {
  const is_builder = mode === "builder";
  const design = field.design || {};
  const content_text = get_field_text(field.content, language);
  const text_links = (field.text_links && field.text_links[language]) || [];
  const live = is_builder ? { text: content_text, links: text_links } : fill_text_tokens(content_text, text_links, allValues);
  const text_style = { color: design.text_color || "#555555", fontFamily: design.font_family || undefined };
  const faded = is_builder && !content_text ? "opacity-50" : "";

  if (ALLOWED_LIST_TYPES.includes(design.list_type) && design.list_type !== "none") {
    const lines_with_offsets = split_lines_with_offsets(live.text).filter((entry) => entry.line.trim().length > 0);
    const ListTag = ORDERED_LIST_TYPES.includes(design.list_type) ? "ol" : "ul";
    return (
      <ListTag className={`text-sm pl-6 ${faded}`.trim()} style={Object.assign({ listStyleType: design.list_type }, text_style)}>
        {lines_with_offsets.map((entry, index) => (
          <li key={index}>
            <DcsLinkedText text={entry.line} links={shift_links_to_range(live.links, entry.start, entry.end)} />
          </li>
        ))}
      </ListTag>
    );
  }

  return (
    <div className={`text-sm ${faded}`.trim()} style={Object.assign({ whiteSpace: "pre-wrap" }, text_style)}>
      <DcsLinkedText text={live.text} links={live.links} />
    </div>
  );
}
