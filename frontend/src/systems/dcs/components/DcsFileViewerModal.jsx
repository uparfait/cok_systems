import React, { useEffect, useState } from "react";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_file_kind } from "./fileKind.js";
import DcsButtonOutlineReverse from "./DcsButtonOutlineReverse.jsx";

const DOC_PREVIEW_STYLE = `
  .cok-doc-preview { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #333333; line-height: 1.5; }
  .cok-doc-preview h1, .cok-doc-preview h2, .cok-doc-preview h3 { color: #056daa; font-family: 'Montserrat', sans-serif; }
  .cok-doc-preview p { margin: 0 0 8pt 0; }
  .cok-doc-preview img { max-width: 100%; height: auto; }
  .cok-doc-preview table { border-collapse: collapse; margin: 8pt 0; max-width: 100%; }
  .cok-doc-preview table td, .cok-doc-preview table th { border: 1px solid #E0E0E0; padding: 4pt 6pt; }
  .cok-doc-preview table th { background: #F7F9FB; font-weight: 600; }
  .cok-doc-preview a { color: #0645AD; text-decoration: underline; word-break: break-all; }
`;

function PreviewSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div
        className="animate-spin rounded-full"
        style={{ width: 32, height: 32, border: "2px solid #056daa", borderTopColor: "transparent" }}
      />
    </div>
  );
}

function PreviewUnavailable() {
  const { translate } = useDcsLanguage();
  return (
    <p className="text-sm text-center py-16" style={{ color: "#9E9E9E" }}>
      {translate("DCS_FILE_VIEWER_UNAVAILABLE")}
    </p>
  );
}

function WordPreview({ fileUrl }) {
  const [html, setHtml] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let is_mounted = true;
    setHtml(null);
    setFailed(false);
    fetch(fileUrl)
      .then((response) => response.arrayBuffer())
      .then((array_buffer) => mammoth.convertToHtml({ arrayBuffer: array_buffer }))
      .then((result) => {
        if (is_mounted) setHtml(result.value || "");
      })
      .catch(() => {
        if (is_mounted) setFailed(true);
      });
    return () => {
      is_mounted = false;
    };
  }, [fileUrl]);

  if (failed) return <PreviewUnavailable />;
  if (html === null) return <PreviewSpinner />;

  return (
    <div className="bg-white mx-auto max-w-[8.5in] px-6 py-8" style={{ border: "1px solid #E0E0E0" }}>
      <div className="cok-doc-preview" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function SpreadsheetPreview({ fileUrl }) {
  const [html, setHtml] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let is_mounted = true;
    setHtml(null);
    setFailed(false);
    fetch(fileUrl)
      .then((response) => response.arrayBuffer())
      .then((array_buffer) => {
        const workbook = XLSX.read(new Uint8Array(array_buffer), { type: "array" });
        const parts = workbook.SheetNames.map((name) => {
          const table = XLSX.utils.sheet_to_html(workbook.Sheets[name]);
          return workbook.SheetNames.length > 1 ? `<h3>${name}</h3>${table}` : table;
        });
        if (is_mounted) setHtml(parts.join(""));
      })
      .catch(() => {
        if (is_mounted) setFailed(true);
      });
    return () => {
      is_mounted = false;
    };
  }, [fileUrl]);

  if (failed) return <PreviewUnavailable />;
  if (html === null) return <PreviewSpinner />;

  return (
    <div className="bg-white p-4 overflow-x-auto" style={{ border: "1px solid #E0E0E0" }}>
      <div className="cok-doc-preview" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function TextPreview({ fileUrl }) {
  const [text, setText] = useState(null);

  useEffect(() => {
    let is_mounted = true;
    setText(null);
    fetch(fileUrl)
      .then((response) => response.text())
      .then((value) => {
        if (is_mounted) setText(value);
      })
      .catch(() => {
        if (is_mounted) setText("");
      });
    return () => {
      is_mounted = false;
    };
  }, [fileUrl]);

  if (text === null) return <PreviewSpinner />;

  return (
    <pre
      className="bg-white p-4 text-xs whitespace-pre-wrap break-words overflow-x-auto"
      style={{ border: "1px solid #E0E0E0", color: "#333333", fontFamily: "Consolas, monospace" }}
    >
      {text}
    </pre>
  );
}

function GenericPreview({ fileUrl, fileName }) {
  const { translate } = useDcsLanguage();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <p className="text-sm text-center break-all" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
        {fileName}
      </p>
      <a href={fileUrl} download={fileName} className="cok-btn-outlined" style={{ padding: "0.5rem 1rem" }}>
        {translate("DCS_BTN_DOWNLOAD")}
      </a>
    </div>
  );
}

export default function DcsFileViewerModal({ fileUrl, fileName, fileType, onClose }) {
  const { translate } = useDcsLanguage();
  const kind = get_file_kind(fileType, fileName);

  useEffect(() => {
    const handle_key = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle_key);
    return () => window.removeEventListener("keydown", handle_key);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div className="relative bg-white w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="cok-bg-primary px-4 py-3 flex items-center justify-between flex-shrink-0 gap-3">
          <span
            className="text-sm font-semibold truncate text-white"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
            title={fileName}
          >
            {fileName}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a href={fileUrl} download={fileName} className="cok-btn-outlined-reverse" style={{ padding: "0.4rem 0.8rem" }}>
              {translate("DCS_BTN_DOWNLOAD")}
            </a>
            <DcsButtonOutlineReverse onClick={onClose}>{translate("DCS_BTN_CLOSE")}</DcsButtonOutlineReverse>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4" style={{ backgroundColor: "#F7F9FB" }}>
          {kind === "pdf" && <iframe title={fileName} src={fileUrl} style={{ width: "100%", height: "75vh", border: "none" }} />}
          {kind === "word" && <WordPreview fileUrl={fileUrl} />}
          {kind === "spreadsheet" && <SpreadsheetPreview fileUrl={fileUrl} />}
          {(kind === "text" || kind === "csv") && <TextPreview fileUrl={fileUrl} />}
          {kind === "html" && (
            <iframe title={fileName} src={fileUrl} sandbox="" style={{ width: "100%", height: "75vh", border: "none", backgroundColor: "#FFFFFF" }} />
          )}
          {kind === "generic" && <GenericPreview fileUrl={fileUrl} fileName={fileName} />}
        </div>
      </div>
      <style>{DOC_PREVIEW_STYLE}</style>
    </div>
  );
}
