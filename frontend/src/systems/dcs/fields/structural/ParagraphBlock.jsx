import React from "react";
import DOMPurify from "dompurify";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { get_field_text } from "../fieldText.js";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";

/**
 * A block of descriptive text with word-processor style formatting: bold,
 * italics and lists while authoring, rendered as sanitized read-only HTML
 * everywhere else.
 */
export default function ParagraphBlock({ field, language, mode, onFieldChange }) {
  const is_builder = mode === "builder";
  const { translate } = useDcsLanguage();
  const content_html = get_field_text(field.content, language);

  const editor = useEditor(
    {
      extensions: [StarterKit],
      content: content_html,
      editable: is_builder,
      onUpdate: ({ editor: editor_instance }) => {
        if (!onFieldChange) return;
        const next_content = Object.assign({}, field.content, { [language]: editor_instance.getHTML() });
        onFieldChange(Object.assign({}, field, { content: next_content }));
      },
    },
    [language],
  );

  if (!is_builder) {
    return (
      <div
        className="text-sm"
        style={{ color: "#555555" }}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content_html) }}
      />
    );
  }

  const toolbar_button = (is_active, on_click, label, title_key) => (
    <button
      type="button"
      onClick={on_click}
      title={translate(title_key)}
      className="px-3 py-1.5 text-sm"
      style={{
        color: is_active ? "#FFFFFF" : "#333333",
        backgroundColor: is_active ? "#056daa" : "#F7F9FB",
        border: "1px solid #E0E0E0",
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full border" style={{ borderColor: "#E0E0E0" }}>
      {editor && (
        <div className="flex flex-wrap gap-1 p-2 border-b" style={{ borderColor: "#E0E0E0", backgroundColor: "#F7F9FB" }}>
          {toolbar_button(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "B", "DCS_PARAGRAPH_BOLD")}
          {toolbar_button(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "I", "DCS_PARAGRAPH_ITALIC")}
          {toolbar_button(
            editor.isActive("bulletList"),
            () => editor.chain().focus().toggleBulletList().run(),
            "• List",
            "DCS_PARAGRAPH_BULLET_LIST",
          )}
          {toolbar_button(
            editor.isActive("orderedList"),
            () => editor.chain().focus().toggleOrderedList().run(),
            "1. List",
            "DCS_PARAGRAPH_ORDERED_LIST",
          )}
        </div>
      )}
      <EditorContent editor={editor} className="prose max-w-none text-sm p-3" />
    </div>
  );
}
