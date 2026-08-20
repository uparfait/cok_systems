import React, { useRef } from "react";
import { get_field_text } from "../fieldText.js";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsLinkedText from "../../components/DcsLinkedText.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import {
  split_lines_with_offsets,
  shift_links_to_range,
  add_link_to_range,
  remove_links_overlapping_range,
} from "../textLinkSegments.js";

const ALLOWED_LIST_TYPES = ["disc", "circle", "square", "decimal", "lower-roman", "upper-roman", "none"];
const ORDERED_LIST_TYPES = ["decimal", "lower-roman", "upper-roman"];

export default function ParagraphBlock({ field, language, mode, onFieldChange }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const content_text = get_field_text(field.content, language);
  const design = field.design || {};
  const fills_container = !!field.section_layout;
  const text_links = (field.text_links && field.text_links[language]) || [];
  const textarea_ref = useRef(null);

  if (!is_builder) {
    const text_style = { color: design.text_color || "#555555", fontFamily: design.font_family || undefined };

    if (ALLOWED_LIST_TYPES.includes(design.list_type) && design.list_type !== "none") {
      const lines_with_offsets = split_lines_with_offsets(content_text).filter((entry) => entry.line.trim().length > 0);
      const ListTag = ORDERED_LIST_TYPES.includes(design.list_type) ? "ol" : "ul";
      return (
        <ListTag className="text-sm pl-6" style={Object.assign({ listStyleType: design.list_type }, text_style)}>
          {lines_with_offsets.map((entry, index) => (
            <li key={index}>
              <DcsLinkedText text={entry.line} links={shift_links_to_range(text_links, entry.start, entry.end)} />
            </li>
          ))}
        </ListTag>
      );
    }

    return (
      <div className="text-sm" style={Object.assign({ whiteSpace: "pre-wrap" }, text_style)}>
        <DcsLinkedText text={content_text} links={text_links} />
      </div>
    );
  }

  const set_text_links = (next_links) => {
    onFieldChange(Object.assign({}, field, { text_links: Object.assign({}, field.text_links, { [language]: next_links }) }));
  };

  const handle_link_selection = () => {
    const textarea = textarea_ref.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (end <= start) return;
    const href = window.prompt(translate("DCS_LINK_PROMPT"), "https://");
    if (!href) return;
    set_text_links(add_link_to_range(text_links, start, end, href));
  };

  const handle_unlink_selection = () => {
    const textarea = textarea_ref.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (end <= start) return;
    set_text_links(remove_links_overlapping_range(text_links, start, end));
  };

  return (
    <div className={fills_container ? "w-full h-full flex flex-col" : "w-full"}>
      <textarea
        ref={textarea_ref}
        className="cok-auth-input w-full py-2"
        style={fills_container ? { flex: 1, minHeight: 0, resize: "none" } : { resize: "none" }}
        rows={fills_container ? undefined : 4}
        value={content_text}
        onChange={(event) => {
          if (!onFieldChange) return;
          const next_content = Object.assign({}, field.content, { [language]: event.target.value });
          onFieldChange(Object.assign({}, field, { content: next_content }));
        }}
      />
      <div className="flex items-center gap-2 mt-1 flex-shrink-0">
        <DcsButtonOutline onClick={handle_link_selection}>{translate("DCS_BTN_LINK")}</DcsButtonOutline>
        <DcsButtonOutline onClick={handle_unlink_selection}>{translate("DCS_BTN_UNLINK")}</DcsButtonOutline>
        <span className="text-xs" style={{ color: "#9E9E9E" }}>
          {translate("DCS_LINK_SELECTION_HINT")}
        </span>
      </div>
    </div>
  );
}
