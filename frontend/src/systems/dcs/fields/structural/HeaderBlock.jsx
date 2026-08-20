import React, { useRef, useState } from "react";
import { get_field_text } from "../fieldText.js";
import DcsLinkedText from "../../components/DcsLinkedText.jsx";
import DcsTextLinkMenu from "../../components/DcsTextLinkMenu.jsx";
import { add_link_to_range, remove_links_overlapping_range, find_link_overlapping_range } from "../textLinkSegments.js";

const HEADING_SIZES = { 1: 28, 2: 24, 3: 21, 4: 18, 5: 16, 6: 14 };

export default function HeaderBlock({ field, language, mode, onFieldChange }) {
  const is_builder = mode === "builder";
  const level = field.level || 2;
  const text_value = get_field_text(field.label, language);
  const HeadingTag = `h${level}`;
  const design = field.design || {};
  const fills_container = !!field.section_layout;
  const text_links = (field.text_links && field.text_links[language]) || [];
  const textarea_ref = useRef(null);
  const [link_menu, setLinkMenu] = useState(null);

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

  const handle_context_menu = (event) => {
    const textarea = textarea_ref.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (end <= start) return;
    event.preventDefault();
    const existing_link = find_link_overlapping_range(text_links, start, end);
    setLinkMenu({ x: event.clientX, y: event.clientY, start, end, initial_url: existing_link ? existing_link.href : "https://" });
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
        onContextMenu={handle_context_menu}
        onChange={(event) => {
          if (!onFieldChange) return;
          const next_label = Object.assign({}, field.label, { [language]: event.target.value });
          onFieldChange(Object.assign({}, field, { label: next_label }));
        }}
      />
      {link_menu && (
        <DcsTextLinkMenu
          x={link_menu.x}
          y={link_menu.y}
          initialUrl={link_menu.initial_url}
          onApply={(href) => {
            set_text_links(add_link_to_range(text_links, link_menu.start, link_menu.end, href));
            setLinkMenu(null);
          }}
          onRemove={() => {
            set_text_links(remove_links_overlapping_range(text_links, link_menu.start, link_menu.end));
            setLinkMenu(null);
          }}
          onClose={() => setLinkMenu(null)}
        />
      )}
    </div>
  );
}
