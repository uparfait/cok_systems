const ExcelJS = require("exceljs");
const { translate } = require("../i18n/index.js");

/**
 * The Excel file of a widget's records: a title line naming the widget,
 * the criteria the rows match (one line each), then the same columns as
 * the records table - Submitted at first, every answerable field after -
 * and a total line. Built whole in memory and handed back as a buffer so
 * the response carries its length and the browser can show real download
 * progress.
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

  const title_row = sheet.addRow([title || "Records"]);
  title_row.font = { bold: true, size: 14, color: { argb: PRIMARY_ARGB } };
  if (period) {
    sheet.addRow([`${translate("TABLE_SUBMITTED_AT", lang)}: ${new Date(period.start).toISOString()} - ${new Date(period.end).toISOString()}`]).font = { italic: true, color: { argb: "FF555555" } };
  }
  (criteria || []).forEach((entry) => {
    sheet.addRow([`${entry.is_time ? translate("TABLE_SUBMITTED_AT", lang) : entry.field_label}: ${cell_text(entry.value)}`]).font = { color: { argb: "FF555555" } };
  });
  sheet.addRow([]);

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

  sheet.addRow([]);
  const total_row = sheet.addRow([`${translate("TABLE_TOTAL", lang)}: ${items.length}`]);
  total_row.font = { bold: true, size: 10, color: { argb: PRIMARY_ARGB } };

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
