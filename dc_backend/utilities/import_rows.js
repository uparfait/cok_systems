const path = require("path");
const ExcelJS = require("exceljs");
const config = require("../configurations/config.js");
const { parse_csv_file } = require("./csv_parser.js");
const { import_error, normalize_table } = require("./import_table.js");
const { format_utc_date, format_utc_time, is_excel_epoch_day } = require("./import_text.js");

/**
 * The rows of an uploaded import file, whatever it is, as one shape -
 * { headers, rows, row_numbers, sheet_name } of plain strings - read the
 * same way by the upload (headers, preview, count) and by the run.
 *
 * An .xlsx is read with ExcelJS's document reader (its streaming reader
 * fails on workbooks whose sheet parts precede workbook.xml - the very
 * layout ExcelJS writes - and exposes no sheet state); memory stays
 * bounded by the upload size cap and the row cap instead. The sheet is
 * "Data" when the workbook has one (a filled template comes back with its
 * "Options" sheet, never data), else the first visible sheet. Every cell
 * becomes the text the CSV reader would have produced: a date YYYY-MM-DD,
 * or YYYY-MM-DD HH:MM when its format carries hours, a time-only cell
 * HH:MM, a number its plain digits (a percent its fraction), a boolean
 * true/false, rich text its runs joined, a hyperlink its text, a formula
 * its cached result, an error value nothing. Merged cells keep the value
 * in their top-left cell only. The workbook's 1904 date system is applied
 * by the reader itself.
 */
const EXCEL_EXTENSIONS = [".xlsx"];
const DATA_SHEET = "data";

function pick_sheet(workbook) {
  const sheets = workbook.worksheets || [];
  return sheets.find((sheet) => String(sheet.name || "").trim().toLowerCase() === DATA_SHEET) || sheets.find((sheet) => !sheet.state || sheet.state === "visible") || null;
}

function cell_ref(reference) {
  const match = /^([A-Z]+)(\d+)$/i.exec(String(reference).trim());
  if (!match) return null;
  let column = 0;
  match[1].toUpperCase().split("").forEach((letter) => {
    column = column * 26 + (letter.charCodeAt(0) - 64);
  });
  return { row: Number(match[2]), column };
}

/** Every cell of a merged range except its top-left one, as "row:column" keys. */
function merged_slaves(sheet) {
  const slaves = new Set();
  const merges = (sheet.model && sheet.model.merges) || [];
  merges.forEach((range) => {
    const [from, to] = String(range).split(":").map(cell_ref);
    if (!from || !to) return;
    for (let row = from.row; row <= to.row; row += 1) {
      for (let column = from.column; column <= to.column; column += 1) {
        if (row !== from.row || column !== from.column) slaves.add(`${row}:${column}`);
      }
    }
  });
  return slaves;
}

function format_excel_date(date, number_format) {
  if (Number.isNaN(date.getTime())) return "";
  const format = String(number_format || "").replace(/\[[^\]]*\]/g, "").replace(/"[^"]*"/g, "");
  const has_hours = /h/i.test(format);
  const has_day = /[dy]/i.test(format);
  if (is_excel_epoch_day(date) || (has_hours && !has_day)) return format_utc_time(date);
  const midnight = date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
  if (has_hours || (!format && !midnight)) return `${format_utc_date(date)} ${format_utc_time(date)}`;
  return format_utc_date(date);
}

/** One Excel cell value as text. */
function cell_text(value, number_format) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return format_excel_date(value, number_format);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value.richText)) return value.richText.map((part) => (part && part.text) || "").join("");
  if (value.formula !== undefined || value.sharedFormula !== undefined) return cell_text(value.result, number_format);
  if (value.text !== undefined) return cell_text(value.text, number_format);
  return "";
}

async function read_excel_file(file_path, options) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(file_path);
  } catch (error) {
    throw import_error("IMPORT_FILE_UNREADABLE");
  }
  const sheet = pick_sheet(workbook);
  if (!sheet) return { headers: [], rows: [], row_numbers: [], sheet_name: null };
  const slaves = merged_slaves(sheet);
  const width = Math.max(sheet.columnCount || 0, sheet.getRow(1).cellCount || 0);
  const lines = [];
  const numbers = [];
  sheet.eachRow({ includeEmpty: false }, (row, number) => {
    const cells = [];
    for (let column = 1; column <= width; column += 1) {
      const cell = row.getCell(column);
      cells.push(slaves.has(`${number}:${column}`) ? "" : cell_text(cell.value, cell.numFmt));
    }
    lines.push(cells);
    numbers.push(number);
  });
  return Object.assign(normalize_table(lines, numbers, options), { sheet_name: sheet.name });
}

const is_excel_file = (file_path) => EXCEL_EXTENSIONS.includes(path.extname(file_path || "").toLowerCase());

async function read_import_rows(file_path) {
  const options = { max_rows: config.import_max_rows };
  if (is_excel_file(file_path)) return read_excel_file(file_path, options);
  return Object.assign(await parse_csv_file(file_path, options), { sheet_name: null });
}

module.exports = { EXCEL_EXTENSIONS, cell_text, format_excel_date, pick_sheet, merged_slaves, read_excel_file, read_import_rows, is_excel_file };
