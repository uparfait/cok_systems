import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

const ICON_SHELL_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "#056daa",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const GENERIC_FILE_ICON = (
  <>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4" />
  </>
);

const WORD_DOCUMENT_ICON = (
  <>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4" />
    <path d="M8 13l1.5 5L11 14l1.5 4L14 13" />
  </>
);

const SPREADSHEET_ICON = (
  <>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4" />
    <line x1="8" y1="12" x2="16" y2="12" />
    <line x1="8" y1="16" x2="16" y2="16" />
    <line x1="11" y1="10" x2="11" y2="19" />
  </>
);

/**
 * Determines the broad file kind from its mime type or extension, used to
 * pick how to preview it.
 */
function get_file_kind(file_type, file_name) {
  const type = (file_type || "").toLowerCase();
  const name = (file_name || "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type.includes("word") || name.endsWith(".doc") || name.endsWith(".docx")) return "word";
  if (type.includes("sheet") || type.includes("excel") || name.endsWith(".xls") || name.endsWith(".xlsx")) return "spreadsheet";
  return "generic";
}

const ICON_BY_KIND = {
  word: WORD_DOCUMENT_ICON,
  spreadsheet: SPREADSHEET_ICON,
  generic: GENERIC_FILE_ICON,
};

/**
 * Renders a file inline according to its type: images, video and audio play
 * back directly, PDFs render in an embedded viewer, and every other type
 * (Word, Excel, anything else) shows a custom icon with the file name and
 * an "open" link, since browsers cannot render those inline.
 */
export default function DcsFilePreview({ fileUrl, fileName, fileType, className }) {
  const { translate } = useDcsLanguage();
  const kind = get_file_kind(fileType, fileName);

  if (kind === "image") {
    return <img src={fileUrl} alt={fileName} className={className || "max-w-full mx-auto"} />;
  }
  if (kind === "video") {
    return <video src={fileUrl} controls className={className || "max-w-full mx-auto"} />;
  }
  if (kind === "audio") {
    return <audio src={fileUrl} controls className={className || "w-full"} />;
  }
  if (kind === "pdf") {
    return className ? (
      <iframe title={fileName} src={fileUrl} className={className} />
    ) : (
      <iframe title={fileName} src={fileUrl} style={{ width: "100%", height: "70vh", border: "none" }} />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8">
      <svg width="56" height="56" {...ICON_SHELL_PROPS}>
        {ICON_BY_KIND[kind] || GENERIC_FILE_ICON}
      </svg>
      <p className="text-sm text-center break-all" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
        {fileName}
      </p>
      <a
        href={fileUrl}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-semibold uppercase"
        style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif" }}
      >
        {translate("DCS_FILE_PREVIEW_OPEN")}
      </a>
    </div>
  );
}
