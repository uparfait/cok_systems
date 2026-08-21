import { DCS_FILE_TYPE_GROUPS } from "../fields/fileTypeGroups.js";

function extensions_for(group_key) {
  const group = DCS_FILE_TYPE_GROUPS.find((entry) => entry.key === group_key);
  return group ? group.extensions : [];
}

const IMAGE_EXTENSIONS = extensions_for("images");
const VIDEO_EXTENSIONS = extensions_for("videos");
const AUDIO_EXTENSIONS = extensions_for("audio");

/**
 * A pasted link (fileType left as the generic "link" marker rather than a
 * real mime type) has no mime type to check at all - only its URL's own
 * extension says what it actually is, so image/video/audio fall back to
 * that extension the same way pdf/word/spreadsheet/csv/html/text already
 * did below, instead of a plain link ever showing as a bare "generic"
 * download when it is really a photo the respondent meant to embed.
 */
export function get_file_kind(file_type, file_name) {
  const type = (file_type || "").toLowerCase();
  const name = (file_name || "").toLowerCase();
  if (type.startsWith("image/") || IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension))) return "image";
  if (type.startsWith("video/") || VIDEO_EXTENSIONS.some((extension) => name.endsWith(extension))) return "video";
  if (type.startsWith("audio/") || AUDIO_EXTENSIONS.some((extension) => name.endsWith(extension))) return "audio";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type.includes("word") || name.endsWith(".doc") || name.endsWith(".docx")) return "word";
  if (type.includes("sheet") || type.includes("excel") || name.endsWith(".xls") || name.endsWith(".xlsx")) return "spreadsheet";
  if (type === "text/csv" || name.endsWith(".csv")) return "csv";
  if (type === "text/html" || name.endsWith(".html") || name.endsWith(".htm")) return "html";
  if (type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".json")) return "text";
  return "generic";
}
