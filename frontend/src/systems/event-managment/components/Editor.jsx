import { useCallback, useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
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
import { FiFileText, FiX, FiMenu } from "react-icons/fi";
import {
  StyledBulletList,
  StyledOrderedList,
  FontSize,
  PageBreak,
} from "./sub-components/extensions";
import WordRibbon from "./sub-components/WordRibbon";
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
  onToggleSidebar = null,
  externalEditorRef = null,
}) {
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [notice, setNotice] = useState("");
  const [pageSize, setPageSize] = useState("letter");
  const [margins, setMargins] = useState("normal");
  const [pageCount, setPageCount] = useState(1);
  const [pageMarks, setPageMarks] = useState([]);
  const [docTick, setDocTick] = useState(0);
  const [findOpen, setFindOpen] = useState(false);
  const [findQ, setFindQ] = useState("");
  const [replaceQ, setReplaceQ] = useState("");
  const [painterActive, setPainterActive] = useState(false);
  const painterMarksRef = useRef(null);
  const pageRef = useRef(null);
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
      PageBreak,
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
      setDocTick((t) => t + 1);
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
        if (files.length === 0) return false;
        event.preventDefault();
        // Place dropped content exactly where the user dropped it
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (coords) {
          const tr = view.state.tr.setSelection(
            TextSelection.near(view.state.doc.resolve(coords.pos)),
          );
          view.dispatch(tr);
        }
        files.forEach((f) => {
          if (f.type.startsWith("image/")) {
            insertImageFromFile(f);
          } else {
            if (f.size > MAX_FILE_BYTES) { showNotice(`"${f.name}" is too large (max 10MB)`); return; }
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = e.target?.result;
              if (!dataUrl || !editorApiRef.current) return;
              const name = escapeAttr(f.name);
              editorApiRef.current
                .chain()
                .focus()
                .insertContent(`<a href="${dataUrl}" download="${name}">${name}</a>&nbsp;`)
                .run();
            };
            reader.readAsDataURL(f);
          }
        });
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
  if (externalEditorRef) externalEditorRef.current = editor;

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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindOpen(true);
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

  // Format painter: capture the marks at the cursor, apply them to the next selection
  const handleFormatPainter = useCallback(() => {
    if (!editorApiRef.current) return;
    const ed = editorApiRef.current;
    if (painterActive) { setPainterActive(false); painterMarksRef.current = null; return; }
    painterMarksRef.current = {
      bold: ed.isActive("bold"),
      italic: ed.isActive("italic"),
      underline: ed.isActive("underline"),
      strike: ed.isActive("strike"),
      color: ed.getAttributes("textStyle").color || null,
      fontFamily: ed.getAttributes("textStyle").fontFamily || null,
      fontSize: ed.getAttributes("textStyle").fontSize || null,
      highlight: ed.isActive("highlight") ? ed.getAttributes("highlight").color || true : null,
    };
    setPainterActive(true);
    showNotice("Formatting copied. Select the text to paint.");
  }, [painterActive, showNotice]);

  const applyPainter = useCallback(() => {
    const marks = painterMarksRef.current;
    const ed = editorApiRef.current;
    if (!marks || !ed || ed.state.selection.empty) return;
    let chain = ed.chain().focus().unsetAllMarks();
    if (marks.bold) chain = chain.setBold();
    if (marks.italic) chain = chain.setItalic();
    if (marks.underline) chain = chain.setUnderline();
    if (marks.strike) chain = chain.setStrike();
    if (marks.color) chain = chain.setColor(marks.color);
    if (marks.fontFamily) chain = chain.setFontFamily(marks.fontFamily);
    if (marks.fontSize) chain = chain.setFontSize(marks.fontSize);
    if (marks.highlight) chain = chain.setHighlight(typeof marks.highlight === "string" ? { color: marks.highlight } : {});
    chain.run();
    painterMarksRef.current = null;
    setPainterActive(false);
  }, []);

  // Find & Replace: plain-text search over the document text nodes
  const findPositions = useCallback((query) => {
    const ed = editorApiRef.current;
    if (!ed || !query) return [];
    const positions = [];
    ed.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      let idx = node.text.toLowerCase().indexOf(query.toLowerCase());
      while (idx !== -1) {
        positions.push({ from: pos + idx, to: pos + idx + query.length });
        idx = node.text.toLowerCase().indexOf(query.toLowerCase(), idx + query.length);
      }
    });
    return positions;
  }, []);

  const handleFindNext = useCallback(() => {
    const ed = editorApiRef.current;
    if (!ed || !findQ.trim()) return;
    const positions = findPositions(findQ.trim());
    if (positions.length === 0) { showNotice(`"${findQ.trim()}" was not found`); return; }
    const after = ed.state.selection.to;
    const next = positions.find((p) => p.from >= after) || positions[0];
    ed.chain().focus().setTextSelection(next).scrollIntoView().run();
    showNotice(`${positions.length} match${positions.length > 1 ? "es" : ""} found`);
  }, [findQ, findPositions, showNotice]);

  const handleReplaceAll = useCallback(() => {
    const ed = editorApiRef.current;
    if (!ed || !findQ.trim()) return;
    const positions = findPositions(findQ.trim());
    if (positions.length === 0) { showNotice(`"${findQ.trim()}" was not found`); return; }
    const tr = ed.state.tr;
    [...positions].reverse().forEach(({ from, to }) => tr.insertText(replaceQ, from, to));
    ed.view.dispatch(tr);
    showNotice(`Replaced ${positions.length} occurrence${positions.length > 1 ? "s" : ""}`);
  }, [findQ, replaceQ, findPositions, showNotice]);

  const openFindReplace = useCallback((query) => {
    if (typeof query === "string" && query.trim()) setFindQ(query.trim());
    setFindOpen(true);
  }, []);

  const handleInsertPage = useCallback(() => {
    const ed = editorApiRef.current;
    if (!ed) return;
    ed.chain().focus().setPageBreak().run();
    showNotice("New page inserted");
  }, [showNotice]);

  // Deletes the page the cursor is on: the content between the surrounding
  // page breaks, together with one adjacent break
  const handleDeletePage = useCallback(() => {
    const ed = editorApiRef.current;
    if (!ed) return;
    const { state } = ed;
    const from = state.selection.from;
    const breaks = [];
    state.doc.descendants((node, pos) => {
      if (node.type.name === "pageBreak") breaks.push(pos);
    });
    let prevBreak = null;
    let nextBreak = null;
    breaks.forEach((bp) => {
      if (bp < from) prevBreak = bp;
      if (bp >= from && nextBreak === null) nextBreak = bp;
    });
    let delFrom;
    let delTo;
    if (nextBreak !== null) {
      delFrom = prevBreak !== null ? prevBreak + 1 : 0;
      delTo = nextBreak + 1;
    } else if (prevBreak !== null) {
      delFrom = prevBreak;
      delTo = state.doc.content.size;
    } else {
      delFrom = 0;
      delTo = state.doc.content.size;
    }
    ed.chain().focus().deleteRange({ from: delFrom, to: delTo }).run();
    showNotice("Page deleted");
  }, [showNotice]);

  // Paginator: pushes every page break to an exact paper-height boundary so
  // all sheets have the same fixed size, and computes where each page ends
  // for the bottom page numbers
  const paginate = useCallback(() => {
    const pageEl = pageRef.current;
    if (!pageEl) return;
    const pageH = pageSize === "a4" ? 1123 : 1056;
    const breaks = Array.from(pageEl.querySelectorAll(".cok-page-break"));
    const marks = [];
    let cursor = 0;
    breaks.forEach((el) => {
      el.style.marginTop = "0px";
      const y = el.offsetTop;
      const desired = cursor + pageH;
      el.style.marginTop = `${Math.max(0, desired - y)}px`;
      const bandTop = Math.max(y, desired);
      marks.push(bandTop - 26);
      cursor = bandTop + el.offsetHeight;
    });
    const total = cursor + pageH;
    pageEl.style.minHeight = `${total}px`;
    marks.push(total - 26);
    setPageMarks(marks);
    setPageCount(breaks.length + 1);
  }, [pageSize]);

  useEffect(() => {
    const t = setTimeout(paginate, 300);
    return () => clearTimeout(t);
  }, [wordCount, charCount, docTick, margins, paginate]);

  const handlePrint = useCallback(() => {
    if (!editor) return;
    const w = window.open("", "_blank");
    if (!w) {
      showNotice("Pop-up blocked - allow pop-ups to print");
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
        accept=".txt,.md,.html,.docx,.doc,.xlsx,.xls,.csv,.pdf"
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
          {onToggleSidebar && (
            <button
              type="button"
              title="Toggle sidebar"
              onClick={onToggleSidebar}
              className="p-1 cursor-pointer transition-colors shrink-0"
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.18)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <FiMenu className="w-4 h-4" />
            </button>
          )}
          <div className="w-5 h-5 bg-white flex items-center justify-center shrink-0" style={{ color: PRIMARY }}>
            <FiFileText className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold truncate" style={{ fontFamily: fontHeading }}>
            {title ? `Edit - ${title}` : "Edit Document"}
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

      <WordRibbon
        editor={editor}
        fontValue={fontValue}
        fontSizeValue={fontSizeValue}
        inTable={inTable}
        onShowLinkDialog={() => setShowLinkDialog(true)}
        onImport={() => fileInputRef.current?.click()}
        onExport={handleExportDocx}
        onInsertImage={() => imageInputRef.current?.click()}
        onAttachFile={() => attachInputRef.current?.click()}
        onPrint={handlePrint}
        onSave={doSave}
        onInsertPage={handleInsertPage}
        onDeletePage={handleDeletePage}
        onFindReplace={openFindReplace}
        onFormatPainter={handleFormatPainter}
        formatPainterActive={painterActive}
        pageSize={pageSize}
        setPageSize={setPageSize}
        margins={margins}
        setMargins={setMargins}
        zoom={zoom}
        setZoom={setZoom}
      />

      {/* Document page */}
      <div
        className="flex-1 overflow-auto py-4 sm:py-8 px-2 sm:px-4 flex justify-center"
        style={{ backgroundColor: "#F3F5F7" }}
        onMouseUp={painterActive ? applyPainter : undefined}
      >
        <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }} className="h-max">
          <div
            ref={pageRef}
            className="bg-white max-w-[calc(100vw-16px)] overflow-hidden relative"
            style={{
              width: pageSize === "a4" ? "210mm" : "8.5in",
              minHeight: pageSize === "a4" ? "297mm" : "11in",
              cursor: painterActive ? "crosshair" : "text",
            }}
            onClick={() => { if (!painterActive) editor.chain().focus().run(); }}
          >
            <div
              style={{
                paddingLeft: margins === "narrow" ? "0.5in" : margins === "wide" ? "1.5in" : "1in",
                paddingRight: margins === "narrow" ? "0.5in" : margins === "wide" ? "1.5in" : "1in",
                paddingTop: "1in",
                paddingBottom: "1in",
              }}
            >
              <EditorContent editor={editor} />
            </div>
            {/* Bottom page numbers, one per sheet */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              {pageMarks.map((y, i) => (
                <div
                  key={i}
                  className="absolute w-full text-center text-[10px] select-none"
                  style={{ top: `${y}px`, color: "#9E9E9E", fontFamily: fontHeading }}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div
        className="text-white text-[12px] px-3 py-1 flex items-center justify-between flex-shrink-0 gap-3"
        style={{ backgroundColor: PRIMARY }}
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <span className="whitespace-nowrap">Page 1 of {pageCount}</span>
          <span className="whitespace-nowrap">{wordCount} Words</span>
          <span className="whitespace-nowrap hidden sm:inline">{charCount} Characters</span>
          {notice && <span className="truncate opacity-90">{notice}</span>}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ButtonHover isSaving={isSaving} />
          <input
            type="range"
            min={50}
            max={200}
            step={10}
            value={zoom}
            onChange={(e) => setZoom(parseInt(e.target.value, 10))}
            title="Zoom"
            className="w-20 sm:w-28 cursor-pointer"
          />
          <span className="whitespace-nowrap w-10 text-right">{zoom} %</span>
        </div>
      </div>

      {/* Find & Replace */}
      {findOpen && (
        <div className="fixed top-24 right-6 z-[1000001] w-72 p-3" style={{ backgroundColor: "#F8F9FA" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#333333", fontFamily: fontHeading }}>Find & Replace</span>
            <button type="button" onClick={() => setFindOpen(false)} className="p-1 cursor-pointer hover:bg-gray-100">
              <FiX className="w-3.5 h-3.5" style={{ color: "#555555" }} />
            </button>
          </div>
          <input
            type="text"
            autoFocus
            value={findQ}
            onChange={(e) => setFindQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleFindNext(); }}
            placeholder="Find"
            className="cok-auth-input w-full text-sm mb-2"
            style={{ paddingLeft: "8px", minHeight: "32px" }}
          />
          <input
            type="text"
            value={replaceQ}
            onChange={(e) => setReplaceQ(e.target.value)}
            placeholder="Replace with"
            className="cok-auth-input w-full text-sm mb-2"
            style={{ paddingLeft: "8px", minHeight: "32px" }}
          />
          <div className="flex gap-2">
            <button type="button" onClick={handleFindNext} className="cok-btn-outlined flex-1 cursor-pointer" style={{ padding: "0.35rem 0.5rem", fontSize: "11px" }}>Find Next</button>
            <button type="button" onClick={handleReplaceAll} className="cok-btn-primary flex-1 cursor-pointer" style={{ width: "auto", padding: "0.35rem 0.5rem", fontSize: "11px" }}>Replace All</button>
          </div>
        </div>
      )}

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
