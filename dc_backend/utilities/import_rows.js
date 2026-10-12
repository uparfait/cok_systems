const path = require("path");
const ExcelJS = require("exceljs");
const { parse_csv_file, normalize_table } = require("./csv_parser.js");

/**
 * The rows of an uploaded import file, whatever it is: a .csv through the
 * CSV reader, an .xlsx through its FIRST sheet (row 1 the headers, the
 * rows under it the data). Both paths hand back the same shape -
 * { headers, rows } of plain strings - so the upload (headers, preview,
 * count) and the run read the file through this one door. An Excel date
 * becomes YYYY-MM-DD, or YYYY-MM-DD HH:MM when it carries a time, a
 * time-only cell HH:MM, a number its plain digits, a formula its result.
 */
const EXCEL_EXTENSIONS = [".xlsx"];
const EXCEL_EPOCH_YEAR = 1899;

const pad_two = (value) => String(value).padStart(2, "0");

function date_text(date) {
  if (Number.isNaN(date.getTime())) return "";
  const time = `${pad_two(date.getUTCHours())}:${pad_two(date.getUTCMinutes())}`;
  if (date.getUTCFullYear() === EXCEL_EPOCH_YEAR) return time;
  const day = `${date.getUTCFullYear()}-${pad_two(date.getUTCMonth() + 1)}-${pad_two(date.getUTCDate())}`;
  const has_time = date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0;
  return has_time ? `${day} ${time}` : day;
}

/** One Excel cell as the text the CSV reader would have produced. */
function cell_text(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return date_text(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value.richText)) return value.richText.map((part) => (part && part.text) || "").join("");
  if (value.formula !== undefined || value.sharedFormula !== undefined) return cell_text(value.result);
  if (value.text !== undefined) return cell_text(value.text);
  if (value.error !== undefined) return "";
  return "";
}

async function read_excel_file(file_path) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file_path);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };
  const lines = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values || [];
    const cells = [];
    for (let index = 1; index < values.length; index += 1) cells.push(cell_text(values[index]));
    lines.push(cells);
  });
  return normalize_table(lines);
}

const is_excel_file = (file_path) => EXCEL_EXTENSIONS.includes(path.extname(file_path || "").toLowerCase());

async function read_import_rows(file_path) {
  if (is_excel_file(file_path)) return read_excel_file(file_path);
  return parse_csv_file(file_path);
}

module.exports = { EXCEL_EXTENSIONS, cell_text, date_text, read_excel_file, read_import_rows, is_excel_file };
