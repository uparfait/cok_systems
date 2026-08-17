import { useState, useEffect, useMemo } from "react";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import {
  FiX, FiFile, FiImage, FiFileText, FiDownload, FiVideo, FiMusic,
  FiChevronLeft, FiChevronRight,
} from "react-icons/fi";

const PRIMARY = "#056daa";
const NEUTRAL_DARK = "#333333";
const GRAY_DISABLED = "#9E9E9E";
const DANGER = "#E74C3C";
const SUCCESS = "#4CAF50";
const BORDER = "#E0E0E0";
const fontHeading = "'Montserrat', sans-serif";

export function getFileType(filename = "", mime = "") {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";

  const ext = filename.toLowerCase().split(".").pop() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (["mp4", "avi", "mov", "mkv", "webm"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "aac", "m4a"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "word";
  if (["xls", "xlsx", "csv"].includes(ext)) return "sheet";
  if (["html", "htm"].includes(ext)) return "html";
  if (["txt", "md", "json", "xml", "css", "js", "ts", "sql", "log"].includes(ext)) return "text";
  return "other";
}

export function getFileIcon(fileType, className = "w-5 h-5") {
  switch (fileType) {
    case "image": return <FiImage className={className} style={{ color: SUCCESS }} />;
    case "video": return <FiVideo className={className} style={{ color: "#9C27B0" }} />;
    case "audio": return <FiMusic className={className} style={{ color: "#3F51B5" }} />;
    case "pdf": return <FiFileText className={className} style={{ color: DANGER }} />;
    case "word": return <FiFileText className={className} style={{ color: "#2B579A" }} />;
    case "sheet": return <FiFileText className={className} style={{ color: "#217346" }} />;
    case "html":
    case "text": return <FiFileText className={className} style={{ color: PRIMARY }} />;
    default: return <FiFile className={className} style={{ color: GRAY_DISABLED }} />;
  }
}

// Files uploaded to the server have a url; legacy entries carry base64 dataUrl
export const fileSrc = (file) => file.url || file.dataUrl;

export function dataUrlToBlob(dataUrl) {
  const [head, base64] = dataUrl.split(",");
  const mime = (head.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function downloadFile(file) {
  const a = document.createElement("a");
  let objectUrl = null;
  if (file.url) {
    a.href = file.url;
  } else {
    objectUrl = URL.createObjectURL(dataUrlToBlob(file.dataUrl));
    a.href = objectUrl;
  }
  a.download = file.name || "file";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Native browser rendering: server files use their URL directly; legacy
// base64 entries become a Blob URL so PDFs open as real documents instead of
// raw binary text
function useViewUrl(file) {
  const entry = useMemo(() => {
    if (file.url) return { url: file.url, owned: false };
    try {
      return { url: URL.createObjectURL(dataUrlToBlob(file.dataUrl)), owned: true };
    } catch {
      return { url: null, owned: false };
    }
  }, [file]);

  useEffect(() => {
    return () => { if (entry.owned && entry.url) URL.revokeObjectURL(entry.url); };
  }, [entry]);

  return entry.url;
}

const docPreviewStyles = `
  .cok-doc-preview { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000; line-height: 1.5; }
  .cok-doc-preview h1 { font-size: 20pt; color: #056daa; font-weight: 500; margin: 12pt 0 6pt; font-family: 'Montserrat', sans-serif; }
  .cok-doc-preview h2 { font-size: 16pt; color: #056daa; font-weight: 500; margin: 10pt 0 4pt; font-family: 'Montserrat', sans-serif; }
  .cok-doc-preview h3 { font-size: 13pt; color: #033b5c; font-weight: 600; margin: 8pt 0 4pt; }
  .cok-doc-preview p { margin: 0 0 8pt 0; }
  .cok-doc-preview ul, .cok-doc-preview ol { padding-left: 24pt; margin: 0 0 8pt; }
  .cok-doc-preview img { max-width: 100%; height: auto; }
  .cok-doc-preview table { border-collapse: collapse; margin: 8pt 0; max-width: 100%; }
  .cok-doc-preview table td, .cok-doc-preview table th { border: 1px solid #bfbfbf; padding: 4pt 6pt; vertical-align: top; }
  .cok-doc-preview table th { background: #E3F2FD; font-weight: 600; }
  .cok-doc-preview a { color: #056daa; text-decoration: underline; word-break: break-all; }
`;

function PreviewLoading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div
        className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: PRIMARY, borderTopColor: "transparent" }}
      />
    </div>
  );
}

function PreviewUnavailable({ file, message }) {
  return (
    <div className="text-center py-12">
      <FiFile className="w-12 h-12 mx-auto mb-4" style={{ color: GRAY_DISABLED }} />
      <p style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
        {message || "Preview not available for this file type"}
      </p>
      <button
        type="button"
        onClick={() => downloadFile(file)}
        className="cok-btn-primary inline-flex items-center gap-2 mt-4"
        style={{ width: "auto", padding: "0.6rem 1.2rem" }}
      >
        <FiDownload className="w-4 h-4" />
        Download File
      </button>
    </div>
  );
}

// Renders Word documents (.docx) as readable text using mammoth
function WordPreview({ file }) {
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setHtml(null);
    setError(null);
    (async () => {
      try {
        const res = await fetch(fileSrc(file));
        const arrayBuffer = await res.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (alive) setHtml(result.value || "<p>(Empty document)</p>");
      } catch (err) {
        console.error("DOCX preview failed:", err);
        if (alive) setError(true);
      }
    })();
    return () => { alive = false; };
  }, [file]);

  if (error) return <PreviewUnavailable file={file} message="This Word document could not be previewed." />;
  if (html == null) return <PreviewLoading />;

  return (
    <div className="bg-white mx-auto max-w-[8.5in] px-6 py-8 sm:px-12 sm:py-12" style={{ border: `1px solid ${BORDER}` }}>
      <div className="cok-doc-preview" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// Renders spreadsheets (.xlsx, .xls, .csv) as tables
function SheetPreview({ file }) {
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setHtml(null);
    setError(null);
    (async () => {
      try {
        const res = await fetch(fileSrc(file));
        const arrayBuffer = await res.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
        const parts = workbook.SheetNames.map((name) => {
          const table = XLSX.utils.sheet_to_html(workbook.Sheets[name]);
          return workbook.SheetNames.length > 1
            ? `<h3 style="margin-top:12pt">${name}</h3>${table}`
            : table;
        });
        if (alive) setHtml(parts.join(""));
      } catch (err) {
        console.error("Spreadsheet preview failed:", err);
        if (alive) setError(true);
      }
    })();
    return () => { alive = false; };
  }, [file]);

  if (error) return <PreviewUnavailable file={file} message="This spreadsheet could not be previewed." />;
  if (html == null) return <PreviewLoading />;

  return (
    <div className="bg-white p-4 overflow-x-auto" style={{ border: `1px solid ${BORDER}` }}>
      <div className="cok-doc-preview" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function TextPreview({ file }) {
  const [text, setText] = useState(null);

  useEffect(() => {
    let alive = true;
    setText(null);
    fetch(fileSrc(file))
      .then((r) => r.text())
      .then((t) => { if (alive) setText(t); })
      .catch(() => { if (alive) setText(""); });
    return () => { alive = false; };
  }, [file]);

  if (text == null) return <PreviewLoading />;

  return (
    <pre
      className="bg-white p-4 text-[13px] whitespace-pre-wrap break-words overflow-x-auto"
      style={{ border: `1px solid ${BORDER}`, color: NEUTRAL_DARK, fontFamily: "Consolas, monospace" }}
    >
      {text}
    </pre>
  );
}

function MediaPreview({ file, fileType }) {
  const blobUrl = useViewUrl(file);
  if (!blobUrl) return <PreviewUnavailable file={file} />;

  if (fileType === "image") {
    return (
      <div className="flex justify-center">
        <img src={blobUrl} alt={file.name} className="max-w-full max-h-[70vh] object-contain" />
      </div>
    );
  }
  if (fileType === "video") {
    return (
      <div className="flex justify-center">
        <video src={blobUrl} controls className="max-w-full" style={{ maxHeight: "70vh" }} />
      </div>
    );
  }
  if (fileType === "audio") {
    return (
      <div className="flex justify-center py-8">
        <audio src={blobUrl} controls className="w-full max-w-md" />
      </div>
    );
  }
  // pdf + html: browser-native rendering inside an iframe
  return (
    <div className="w-full h-[70vh]">
      <iframe
        src={blobUrl}
        className="w-full h-full border-0 bg-white"
        title={file.name}
        sandbox={fileType === "html" ? "" : undefined}
      />
    </div>
  );
}

export function FilePreview({ file }) {
  const fileType = getFileType(file.name, file.type);

  switch (fileType) {
    case "image":
    case "video":
    case "audio":
    case "pdf":
    case "html":
      return <MediaPreview file={file} fileType={fileType} />;
    case "word":
      return <WordPreview file={file} />;
    case "sheet":
      return <SheetPreview file={file} />;
    case "text":
      return <TextPreview file={file} />;
    default:
      return <PreviewUnavailable file={file} />;
  }
}

/**
 * Full-screen file viewer.
 * mode "single": shows files[startIndex] with previous/next navigation.
 * mode "merged": shows every file stacked in one continuous view.
 */
export default function MinutesFileViewer({ files, startIndex = 0, mode = "single", onClose }) {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => { setIndex(startIndex); }, [startIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (mode === "single") {
        if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
        if (e.key === "ArrowRight") setIndex((i) => Math.min(files.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, files.length, onClose]);

  if (!files || files.length === 0) return null;

  const isMerged = mode === "merged";
  const current = files[Math.min(index, files.length - 1)];
  const headerTitle = isMerged ? `All Files (${files.length})` : current.name;
  const headerType = isMerged ? "other" : getFileType(current.name, current.type);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999999] p-2 sm:p-4">
      <div className="bg-white w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] flex flex-col" style={{ borderRadius: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0" style={{ backgroundColor: PRIMARY }}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 flex-shrink-0 hidden sm:block" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
              {getFileIcon(headerType)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-lg font-semibold truncate text-white" style={{ fontFamily: fontHeading }}>
                {headerTitle}
              </h2>
              {!isMerged && files.length > 1 && (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.8)" }}>
                  File {index + 1} of {files.length}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {!isMerged && (
              <button
                type="button"
                onClick={() => downloadFile(current)}
                title="Download"
                className="cok-btn-outlined-reverse"
                style={{ padding: "0.4rem 0.8rem" }}
              >
                <FiDownload className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="cok-btn-outlined-reverse"
              style={{ padding: "0.4rem 0.8rem" }}
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-3 sm:p-4" style={{ backgroundColor: "#F7F9FB" }}>
          {isMerged ? (
            <div className="space-y-6">
              {files.map((f, i) => (
                <div key={f.id || i}>
                  <div
                    className="flex items-center justify-between gap-2 px-3 py-2 mb-2 bg-white"
                    style={{ border: `1px solid ${BORDER}`, borderLeft: `3px solid ${PRIMARY}` }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {getFileIcon(getFileType(f.name, f.type), "w-4 h-4")}
                      <span className="text-sm font-semibold truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                        {f.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadFile(f)}
                      title="Download"
                      className="shrink-0 cursor-pointer p-1 transition-colors"
                      style={{ color: PRIMARY }}
                    >
                      <FiDownload className="w-4 h-4" />
                    </button>
                  </div>
                  <FilePreview file={f} />
                </div>
              ))}
            </div>
          ) : (
            <FilePreview file={current} />
          )}
        </div>

        {/* Footer navigation for one-by-one reading */}
        {!isMerged && files.length > 1 && (
          <div
            className="flex items-center justify-between px-3 sm:px-6 py-2.5 flex-shrink-0 bg-white"
            style={{ borderTop: `1px solid ${BORDER}` }}
          >
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="cok-btn-outlined inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ padding: "0.45rem 0.9rem" }}
            >
              <FiChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
              {index + 1} / {files.length}
            </span>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(files.length - 1, i + 1))}
              disabled={index === files.length - 1}
              className="cok-btn-outlined inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ padding: "0.45rem 0.9rem" }}
            >
              Next
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <style>{docPreviewStyles}</style>
      </div>
    </div>
  );
}
