const ExcelJS = require("exceljs");
const { translate } = require("../i18n/index.js");

/**
 * The Excel file of a widget's records: the header row first (Submitted
 * at, then every answerable field, the same columns as the records table)
 * and one row per record, nothing else - no title, criteria or total
 * lines, so the sheet opens as plain data. Built whole in memory and handed
 * back as a buffer so the response carries its length and the browser can
 * show real download progress. The widget title only names the file.
 */

const PRIMARY_ARGB = "FF056DAA";

function sanitize_filename(name) {
  return (
    String(name || "records")
      .replace(/[^a-zA-Z0-9_\-\s]/g, "")
      .trim()
      .replace(/\s+/g, "_") || "records"
  );
}

function cell_text(value) {
  if (value === undefined || value === null || value === "") return "";
  if (Array.isArray(value)) return value.map(cell_text).filter(Boolean).join(", ");
  if (typeof value === "object") {
    if (value.full_address) return String(value.full_address);
    if (value.name) return String(value.name);
    if (value.url) return String(value.url);
    return JSON.stringify(value);
  }
  return String(value);
}

async function build_records_workbook({ title, items, columns, criteria, period, language }) {
  const lang = language || "en";
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Records");

  const header_keys = ["submitted_at"].concat(columns.map((column) => column.id));
  const header_labels = [translate("TABLE_SUBMITTED_AT", lang)].concat(columns.map((column) => column.label || column.id));
  const header_row = sheet.addRow(header_labels);
  header_row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header_row.alignment = { horizontal: "center", vertical: "middle" };
  header_row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_ARGB } };
    cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });
  sheet.columns = header_keys.map((key) => ({ key, width: key === "submitted_at" ? 24 : 22 }));

  items.forEach((item) => {
    const row = { submitted_at: item.submitted_at ? new Date(item.submitted_at).toISOString() : "" };
    columns.forEach((column) => {
      row[column.id] = cell_text(item.data ? item.data[column.id] : undefined);
    });
    sheet.addRow(row);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer: Buffer.from(buffer), filename: `${sanitize_filename(title)}.xlsx` };
}

/** Writes the workbook as a download with its length, so the client can show progress. */
function send_workbook(res, file, total_records) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.setHeader("Content-Length", file.buffer.length);
  res.setHeader("X-Total-Records", total_records);
  return res.status(200).send(file.buffer);
}

module.exports = {
  build_records_workbook,
  send_workbook,
};
