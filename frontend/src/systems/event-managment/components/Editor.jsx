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
import { Image } from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { FiFileText, FiX } from "react-icons/fi";
import {
  StyledBulletList,
  StyledOrderedList,
  FontSize,
} from "./sub-components/extensions";
import RibbonToolbar from "./sub-components/RibbonToolbar";
import LinkDialog from "./sub-components/LinkDialog";
import ContextMenu from "./sub-components/ContextMenu";
import { useEditorHeight } from "./sub-components/hooks";
import { exportToDocx, handleImport } from "./sub-components/fileOperations";
import { editorStyles, printStyles } from "./sub-components/styles";
import ButtonHover from "./sub-components/ButtonHover";

const PRIMARY = "#056daa";
const fontHeading = "'Montserrat', sans-serif";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

const escapeAttr = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function Editor({
  onChange,
  initialContent = "",
  isSaving,
  title = "",
  handleClose,
  handleSave,
}) {
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [notice, setNotice] = useState("");
  const editorApiRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const attachInputRef = useRef(null);
  const noticeTimerRef = useRef(null);

  const showNotice = useCallback((msg) => {
    setNotice(msg);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(""), 4000);
  }, []);

  // Reads an image file and inserts it as a base64 image at the cursor.
  const insertImageFromFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > MAX_IMAGE_BYTES) {
      showNotice("Image too large (max 5MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result;
      if (src && editorApiRef.current) {
        editorApiRef.current.chain().focus().setImage({ src, alt: file.name }).run();
      }
    };
    reader.readAsDataURL(file);
  }, [showNotice]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        bulletList: false,
        orderedList: false,
        link: false,
        underline: false,
      }),
      StyledBulletList,
      StyledOrderedList,
      TextStyle,
      FontFamily,
      FontSize,
      Underline,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        defaultAlignment: "left",
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        isAllowedUri: (url, ctx) => url.startsWith("data:") || ctx.defaultValidate(url),
        HTMLAttributes: {
          class: "cursor-pointer",
        },
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: { class: "editor-image" },
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
    content: "",
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
      setCharCount(text.length);
      if (onChange) onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "tiptap-msword focus:outline-none w-full text-left",
        spellcheck: "true",
      },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files || []);
        const images = files.filter((f) => f.type.startsWith("image/"));
        if (images.length === 0) return false;
        event.preventDefault();
        images.forEach((f) => insertImageFromFile(f));
        return true;
      },
      handleDrop: (view, event, slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files || []);
        const images = files.filter((f) => f.type.startsWith("image/"));
        if (images.length === 0) return false;
        event.preventDefault();
        images.forEach((f) => insertImageFromFile(f));
        return true;
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

  editorApiRef.current = editor;

  // Load the fetched document into the editor (supports both raw HTML strings
  // and the minutes object returned by the API)
  useEffect(() => {
    if (!editor) return;
    const content =
      typeof initialContent === "string" ? initialContent : initialContent?.content;
    if (content) {
      editor.commands.setContent(content, { emitUpdate: false });
      const text = editor.getText();
      setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
      setCharCount(text.length);
    }
  }, [initialContent, editor]);

  useEditorHeight(editor);

  const doSave = useCallback(() => {
    if (editor && handleSave) {
      handleSave(editor.getHTML());
      showNotice("Saving document…");
    }
  }, [editor, handleSave, showNotice]);

  // Ctrl+S / Cmd+S saves instead of opening the browser save dialog
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        doSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [doSave]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const handleLinkSubmit = useCallback(
    (url, text) => {
      if (!editor) return;
      if (url === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }
      if (text && editor.state.selection.empty) {
        editor
          .chain()
          .focus()
          .insertContent(`<a href="${escapeAttr(url)}">${escapeAttr(text)}</a>`)
          .run();
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
          navigator.clipboard
            .readText()
            .then((text) => {
              if (text) editor.chain().focus().insertContent(text).run();
            })
            .catch(() => {});
          break;
        case "selectAll":
          editor.commands.selectAll();
          break;
      }
      setContextMenu(null);
    },
    [editor],
  );

  const handleImportFile = useCallback(
    (event) => {
      handleImport(event, editor);
      showNotice("Document imported");
    },
    [editor, showNotice],
  );

  const handleExportDocx = useCallback(async () => {
    await exportToDocx(editor, title || "document");
    showNotice("Exported to Word (.docx)");
  }, [editor, title, showNotice]);

  const handleImagePick = useCallback(
    (event) => {
      const files = Array.from(event.target.files || []);
      files.forEach((f) => insertImageFromFile(f));
      event.target.value = "";
    },
    [insertImageFromFile],
  );

  // Attach any file: embedded as a downloadable link inside the document
  const handleFileAttach = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !editor) return;
      if (file.size > MAX_FILE_BYTES) {
        showNotice("File too large (max 10MB)");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result;
        if (!dataUrl) return;
        const name = escapeAttr(file.name);
        editor
          .chain()
          .focus()
          .insertContent(
            `<a href="${dataUrl}" download="${name}">📎 ${name}</a>&nbsp;`,
          )
          .run();
        showNotice(`Attached "${file.name}"`);
      };
      reader.readAsDataURL(file);
    },
    [editor, showNotice],
  );

  const handlePrint = useCallback(() => {
    if (!editor) return;
    const w = window.open("", "_blank");
    if (!w) {
      showNotice("Pop-up blocked — allow pop-ups to print");
      return;
    }
    w.document.write(
      `<!doctype html><html><head><title>${escapeAttr(title || "Document")}</title>` +
        `<style>${printStyles}</style></head>` +
        `<body><div class="tiptap-msword">${editor.getHTML()}</div>` +
        `<script>window.onload = function(){ window.print(); };</` + `script></body></html>`,
    );
    w.document.close();
    w.focus();
  }, [editor, title, showNotice]);

  if (!editor) return null;

  const headingValue = (() => {
    for (let i = 1; i <= 4; i++)
      if (editor.isActive("heading", { level: i })) return `${i}`;
    return "paragraph";
  })();

  const fontValue = editor.getAttributes("textStyle").fontFamily || "";
  const fontSizeValue = (editor.getAttributes("textStyle").fontSize || "").replace("pt", "");
  const inTable = editor.isActive("table");
  const bulletStyle = editor.isActive("bulletList")
    ? editor.getAttributes("bulletList").listStyleType || ""
    : "";
  const orderedStyle = editor.isActive("orderedList")
    ? editor.getAttributes("orderedList").listStyleType || ""
    : "";

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ backgroundColor: "#F7F9FB" }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.html,.docx,.doc,.xlsx,.xls,.csv"
        onChange={handleImportFile}
        className="hidden"
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImagePick}
        className="hidden"
      />
      <input
        ref={attachInputRef}
        type="file"
        onChange={handleFileAttach}
        className="hidden"
      />

      {/* Title bar */}
      <div
        className="text-white pl-3 sm:pl-4 pr-0 text-[13px] flex items-center justify-between flex-shrink-0"
        style={{ backgroundColor: PRIMARY }}
      >
        <div className="flex items-center gap-2 min-w-0 py-1.5">
          <div className="w-5 h-5 bg-white flex items-center justify-center shrink-0" style={{ color: PRIMARY }}>
            <FiFileText className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold truncate" style={{ fontFamily: fontHeading }}>
            {title ? `Edit — ${title}` : "Edit Document"}
          </span>
        </div>
        <button
          type="button"
          title="Close editor"
          onClick={() => handleClose?.()}
          className="self-stretch px-3 cursor-pointer transition-colors flex items-center justify-center"
          style={{ backgroundColor: "transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#E74C3C"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          <FiX className="w-4.5 h-4.5" />
        </button>
      </div>

      <RibbonToolbar
        editor={editor}
        fontValue={fontValue}
        fontSizeValue={fontSizeValue}
        headingValue={headingValue}
        bulletStyle={bulletStyle}
        orderedStyle={orderedStyle}
        inTable={inTable}
        setListStyle={setListStyle}
        onShowLinkDialog={() => setShowLinkDialog(true)}
        onImport={() => fileInputRef.current?.click()}
        onExport={handleExportDocx}
        onInsertImage={() => imageInputRef.current?.click()}
        onAttachFile={() => attachInputRef.current?.click()}
        onPrint={handlePrint}
        onSave={doSave}
      />

      {/* Document page */}
      <div className="flex-1 overflow-auto py-4 sm:py-8 px-2 sm:px-4 flex justify-center" style={{ backgroundColor: "#EDF1F5" }}>
        <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }} className="h-max">
          <div
            className="bg-white w-[8.5in] max-w-[calc(100vw-16px)]"
            style={{ minHeight: "11in", border: "1px solid #E0E0E0" }}
            onClick={() => editor.chain().focus().run()}
          >
            <div className="bg-white px-6 py-10 sm:px-14 sm:py-16">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div
        className="text-white text-[12px] px-3 py-1 flex items-center justify-between flex-shrink-0 gap-3"
        style={{ backgroundColor: PRIMARY, borderTop: "1px solid rgba(255,255,255,0.25)" }}
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <span className="whitespace-nowrap">{wordCount} Words</span>
          <span className="whitespace-nowrap hidden sm:inline">{charCount} Characters</span>
          {notice && <span className="truncate opacity-90">{notice}</span>}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            title="Zoom"
            className="bg-transparent text-white text-[12px] cursor-pointer focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.4)", borderRadius: 0, padding: "1px 4px" }}
          >
            <option value={0.75} style={{ color: "#333" }}>75%</option>
            <option value={1} style={{ color: "#333" }}>100%</option>
            <option value={1.25} style={{ color: "#333" }}>125%</option>
            <option value={1.5} style={{ color: "#333" }}>150%</option>
          </select>
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
