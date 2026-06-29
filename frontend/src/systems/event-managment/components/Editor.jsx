import { useCallback, useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Underline } from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Link } from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import {
  StyledBulletList,
  StyledOrderedList,
} from "./sub-components/extensions";
import RibbonToolbar from "./sub-components/RibbonToolbar";
import LinkDialog from "./sub-components/LinkDialog";
import ContextMenu from "./sub-components/ContextMenu";
import { useEditorHeight } from "./sub-components/hooks";
import { exportToDocx, handleImport } from "./sub-components/fileOperations";
import { editorStyles } from "./sub-components/styles";
import ButtonHover from "./sub-components/ButtonHover";

export default function Editor({
  onChange,
  initialContent = "",
  isSaving,
  title = "",
  handleClose,
}) {

  

  const [EditorText, SetEditorText] = useState("");
  const [TotalTexts, SetTotalTexts] = useState(0);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        bulletList: false,
        orderedList: false,
      }),
      StyledBulletList,
      StyledOrderedList,
      TextStyle,
      FontFamily,
      Underline,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        defaultAlignment: "left",
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: "text-[#0563c1] underline cursor-pointer hover:text-[#034a8c]",
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: "msword-table" },
        allowTableNodeSelection: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: 920392039,
    onUpdate: ({ editor }) => {
      SetEditorText(editor.getHTML());
      SetTotalTexts(
        editor.getText().trim().split(/\s+/).filter(Boolean).length,
      );
      if (onChange) onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "tiptap-msword focus:outline-none w-full text-left",
        spellcheck: "true",
      },
      handleDOMEvents: {
        contextmenu: (view, event) => {
          event.preventDefault();
          const pos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          if (!pos) return false;
          setContextMenu({ x: event.clientX, y: event.clientY, pos: pos.pos });
          return true;
        },
        click: () => {
          setContextMenu(null);
          return false;
        },
      },
    },
  });

useEffect(() => {
  if (initialContent?.content) {
    editor.commands.setContent(initialContent?.content);
  }
}, [initialContent]);

  useEditorHeight(editor);

  const handleLinkSubmit = useCallback(
    (url, text) => {
      if (!editor) return;
      if (url === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    },
    [editor],
  );

  const setListStyle = useCallback(
    (kind, value) => {
      if (!editor) return;
      const node = kind === "bullet" ? "bulletList" : "orderedList";
      if (!editor.isActive(node)) {
        const chain = editor.chain().focus();
        (kind === "bullet"
          ? chain.toggleBulletList()
          : chain.toggleOrderedList()
        ).run();
      }
      editor
        .chain()
        .focus()
        .updateAttributes(node, { listStyleType: value || null })
        .run();
    },
    [editor],
  );

  const handleContextMenuAction = useCallback(
    (action) => {
      if (!editor) return;
      switch (action) {
        case "cut":
          navigator.clipboard.writeText(
            editor.state.doc.textBetween(
              editor.state.selection.from,
              editor.state.selection.to,
            ),
          );
          editor.commands.deleteSelection();
          break;
        case "copy":
          navigator.clipboard.writeText(
            editor.state.doc.textBetween(
              editor.state.selection.from,
              editor.state.selection.to,
            ),
          );
          break;
        case "paste":
          break;
        case "selectAll":
          editor.commands.selectAll();
          break;
      }
      setContextMenu(null);
    },
    [editor],
  );

  if (!editor) return null;

  const headingValue = (() => {
    for (let i = 1; i <= 4; i++)
      if (editor.isActive("heading", { level: i })) return `${i}`;
    return "paragraph";
  })();

  const fontValue = editor.getAttributes("textStyle").fontFamily || "";
  const inTable = editor.isActive("table");
  const bulletStyle = editor.isActive("bulletList")
    ? editor.getAttributes("bulletList").listStyleType || ""
    : "";
  const orderedStyle = editor.isActive("orderedList")
    ? editor.getAttributes("orderedList").listStyleType || ""
    : "";

  const handleImportFile = useCallback(
    (event) => {
      handleImport(event, editor);
    },
    [editor],
  );

  const handleExportDocx = useCallback(async () => {
    await exportToDocx(editor);
  }, [editor]);

  return (
    <div className="w-full h-full bg-[#f3f2f1] flex flex-col overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.html,.docx,.doc,.xlsx,.xls,.csv"
        onChange={handleImportFile}
        className="hidden"
      />

      <div className="bg-[#185abd] text-white px-4 py-1.5 text-[13px] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-white text-[#185abd] rounded-sm flex items-center justify-center font-bold text-[12px]">
            W
          </div>
          <span className="font-medium">Edit {`(${title})`}</span>
        </div>
        <div className="bg-red-600 hover:bg-red-500 cursor-pointer absolute right-0 p-1 text-[2px]" onClick={()=>handleClose()}>
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
      </div>

      <RibbonToolbar
        editor={editor}
        fontValue={fontValue}
        headingValue={headingValue}
        bulletStyle={bulletStyle}
        orderedStyle={orderedStyle}
        inTable={inTable}
        setListStyle={setListStyle}
        onShowLinkDialog={() => setShowLinkDialog(true)}
        onImport={() => fileInputRef.current?.click()}
        onExport={handleExportDocx}
      />

      <div className="flex-1 overflow-auto py-8 px-4 flex justify-center bg-[#f3f2f1]">
        <div
          className="bg-white w-[8.5in] max-w-full"
          style={{ minHeight: "11in" }}
          onClick={() => editor.chain().focus().run()}
        >
          <div className="px-14 bg-white py-16">
            <EditorContent editor={editor} ref={editorRef} />
          </div>
        </div>
      </div>

      <div className="bg-[#2b7cd3] h-7.5 text-white text-[12px] px-3 py-1 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span>{TotalTexts} Words</span>
        </div>
        <div className="flex items-center h-7.5">
          <ButtonHover isSaving={isSaving} />
        </div>
      </div>

      {showLinkDialog && (
        <LinkDialog
          onClose={() => setShowLinkDialog(false)}
          onSubmit={handleLinkSubmit}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onAction={handleContextMenuAction}
        />
      )}

      <style>{editorStyles}</style>
    </div>
  );
}
