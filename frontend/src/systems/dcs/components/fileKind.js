export function get_file_kind(file_type, file_name) {
  const type = (file_type || "").toLowerCase();
  const name = (file_name || "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type.includes("word") || name.endsWith(".doc") || name.endsWith(".docx")) return "word";
  if (type.includes("sheet") || type.includes("excel") || name.endsWith(".xls") || name.endsWith(".xlsx")) return "spreadsheet";
  if (type === "text/csv" || name.endsWith(".csv")) return "csv";
  if (type === "text/html" || name.endsWith(".html") || name.endsWith(".htm")) return "html";
  if (type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".json")) return "text";
  return "generic";
}
