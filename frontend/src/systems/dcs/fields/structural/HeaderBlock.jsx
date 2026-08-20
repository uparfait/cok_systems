import React, { useRef } from "react";
import { get_field_text } from "../fieldText.js";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsLinkedText from "../../components/DcsLinkedText.jsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import { add_link_to_range, remove_links_overlapping_range } from "../textLinkSegments.js";

const HEADING_SIZES = { 1: 28, 2: 24, 3: 21, 4: 18, 5: 16, 6: 14 };

export default function HeaderBlock({ field, language, mode, onFieldChange }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const level = field.level || 2;
  const text_value = get_field_text(field.label, language);
  const HeadingTag = `h${level}`;
  const design = field.design || {};
  const fills_container = !!field.section_layout;
  const text_links = (field.text_links && field.text_links[language]) || [];
  const textarea_ref = useRef(null);

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
      <DcsLinkedText key="linked" text={text_value} links={text_links} />,
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
        style={
          fills_container
            ? { fontWeight: 700, fontSize: HEADING_SIZES[level], flex: 1, minHeight: 0, resize: "none" }
            : { fontWeight: 700, fontSize: HEADING_SIZES[level], resize: "none" }
        }
        rows={fills_container ? undefined : 2}
        value={text_value}
        onChange={(event) => {
          if (!onFieldChange) return;
          const next_label = Object.assign({}, field.label, { [language]: event.target.value });
          onFieldChange(Object.assign({}, field, { label: next_label }));
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
