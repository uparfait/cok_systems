import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsFileViewerModal from "./DcsFileViewerModal.jsx";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico", ".tiff", ".avif"];
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv", ".m4v", ".flv"];
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".wma", ".opus"];

const IMAGE_HOST_PATTERNS = [
  /encrypted-tbn0\.gstatic\.com/,
  /googleusercontent\.com/,
  /gstatic\.com/,
  /imgur\.com/,
  /i\.ibb\.co/,
  /cloudinary\.com/,
  /res\.cloudinary\.com/,
  /images\.unsplash\.com/,
  /unsplash\.com/,
  /pexels\.com/,
  /pixabay\.com/,
  /flickr\.com/,
  /staticflickr\.com/,
  /pinimg\.com/,
  /media\.gycat\.com/,
  /media\d+\.giphy\.com/,
  /giphy\.com/,
  /tenor\.com/,
  /media\.tenor\.com/,
];

function detect_kind_from_url(url) {
  const lower = url.toLowerCase();

  for (const ext of IMAGE_EXTENSIONS) {
    if (lower.includes(ext)) return "image";
  }
  for (const ext of VIDEO_EXTENSIONS) {
    if (lower.includes(ext)) return "video";
  }
  for (const ext of AUDIO_EXTENSIONS) {
    if (lower.includes(ext)) return "audio";
  }
  if (lower.includes(".pdf")) return "pdf";

  for (const pattern of IMAGE_HOST_PATTERNS) {
    if (pattern.test(lower)) return "image";
  }

  return null;
}

function InlineImagePreview({ src, onClick }) {
  const [status, setStatus] = useState("loading");

  if (status === "error") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer text-xs hover:underline flex items-center justify-center rounded-none"
        style={{ width: 80, height: 60, backgroundColor: "#F7F9FB", border: "1px solid #E0E0E0", color: "#9E9E9E" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor" />
        </svg>
      </button>
    );
  }

  return (
    <div style={{ position: "relative", width: 80, height: 60 }}>
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "#F7F9FB" }}>
          <div
            className="animate-spin rounded-full"
            style={{ width: 16, height: 16, border: "2px solid #056daa", borderTopColor: "transparent" }}
          />
        </div>
      )}
      <img
        src={src}
        alt="preview"
        onClick={onClick}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        className="cursor-pointer rounded-none"
        style={{
          maxWidth: 80,
          maxHeight: 60,
          objectFit: "cover",
          border: "1px solid #E0E0E0",
          display: status === "loaded" ? "block" : "none",
        }}
      />
    </div>
  );
}

function InlineVideoPreview({ src, onClick }) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer flex items-center justify-center rounded-none"
      style={{ width: 80, height: 60, backgroundColor: "#000000", border: "1px solid #E0E0E0" }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M8 5v14l11-7z" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

function InlineAudioPreview({ src, onClick }) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer flex items-center justify-center rounded-none"
      style={{ width: 80, height: 60, backgroundColor: "#F7F9FB", border: "1px solid #E0E0E0" }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" fill="#056daa" />
      </svg>
    </div>
  );
}

function InlineFileLink({ fileName, onClick }) {
  const extension = (fileName.split(".").pop() || "").toLowerCase();
  const display_name = fileName.length > 15 ? `${fileName.slice(0, 12)}...${extension ? "." + extension : ""}` : fileName;

  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer text-xs hover:underline flex items-center gap-1 rounded-none"
      style={{ background: "none", border: "none", padding: 0, color: "#056daa", fontFamily: "'Montserrat', sans-serif" }}
      title={fileName}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor" />
      </svg>
      {display_name}
    </button>
  );
}

export default function DcsDataTableFileCell({ value, fieldType }) {
  const { translate } = useDcsLanguage();
  const [is_open, setIsOpen] = useState(false);

  const is_object_answer = value && typeof value === "object";
  const file_url = is_object_answer ? value.url || value.data_url : value;
  if (!file_url) return null;

  const file_name = (is_object_answer && value.name) || file_url.split("/").pop()?.split("?")[0] || fieldType;
  const file_type = (is_object_answer && value.type) || "";
  const is_link = is_object_answer && value.is_link === true;

  const handle_open = () => {
    setIsOpen(true);
  };

  const get_kind = () => {
    if (is_link || file_type === "link") {
      const url_hint = detect_kind_from_url(file_url);
      if (url_hint) return url_hint;
      return "image";
    }

    const type = (file_type || "").toLowerCase();
    const name = (file_name || "").toLowerCase();
    if (type.startsWith("image/") || IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext))) return "image";
    if (type.startsWith("video/") || VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext))) return "video";
    if (type.startsWith("audio/") || AUDIO_EXTENSIONS.some((ext) => name.endsWith(ext))) return "audio";
    if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
    if (type.includes("word") || name.endsWith(".doc") || name.endsWith(".docx")) return "word";
    if (type.includes("sheet") || type.includes("excel") || name.endsWith(".xls") || name.endsWith(".xlsx")) return "spreadsheet";
    if (type === "text/csv" || name.endsWith(".csv")) return "csv";
    if (type === "text/html" || name.endsWith(".html") || name.endsWith(".htm")) return "html";
    if (type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".json")) return "text";
    return "generic";
  };

  const kind = get_kind();

  const render_inline_preview = () => {
    if (kind === "image") {
      return <InlineImagePreview src={file_url} onClick={handle_open} />;
    }
    if (kind === "video") {
      return <InlineVideoPreview src={file_url} onClick={handle_open} />;
    }
    if (kind === "audio") {
      return <InlineAudioPreview src={file_url} onClick={handle_open} />;
    }
    return <InlineFileLink fileName={file_name} onClick={handle_open} />;
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {render_inline_preview()}
      </div>
      {is_open && (
        <DcsFileViewerModal
          fileUrl={file_url}
          fileName={file_name}
          fileType={file_type}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
