const fs = require("fs");
const { normalize_table } = require("./import_table.js");

/**
 * A small CSV reader for uploaded files, with no package behind it:
 * RFC 4180 quoting (a quoted cell may hold the delimiter, line breaks and
 * doubled quotes), CRLF / LF / CR line ends, a leading UTF-8 BOM, and a
 * delimiter read off the header line (comma, semicolon or tab - a
 * spreadsheet saved in a French locale separates with semicolons). Every
 * cell comes back as a string; the first line is the header row.
 */
const DELIMITERS = [",", ";", "\t"];

function strip_bom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Counts each candidate delimiter outside quotes on the first line and keeps the most frequent one. */
function detect_delimiter(text) {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && counts[ch] !== undefined) counts[ch] += 1;
  }
  return DELIMITERS.reduce((best, candidate) => (counts[candidate] > counts[best] ? candidate : best), ",");
}

function split_rows(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  let index = 0;
  while (index < text.length) {
    const ch = text[index];
    if (quoted) {
      if (ch === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      cell += ch;
      index += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      index += 1;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell);
      cell = "";
      index += 1;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      index += ch === "\r" && text[index + 1] === "\n" ? 2 : 1;
      continue;
    }
    cell += ch;
    index += 1;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/**
 * { headers, rows, row_numbers, delimiter }: the lines as the file has
 * them (a blank line still counts in the numbering, so a message can name
 * the line as an editor shows it), then the shared table rules of
 * utilities/import_table.js.
 */
function parse_csv_text(text, options) {
  const body = strip_bom(typeof text === "string" ? text : String(text || ""));
  const delimiter = detect_delimiter(body);
  return Object.assign(normalize_table(split_rows(body, delimiter), null, options), { delimiter });
}

async function parse_csv_file(file_path, options) {
  const text = await fs.promises.readFile(file_path, "utf8");
  return parse_csv_text(text, options);
}

/** One CSV line: a cell holding the delimiter, a quote or a line break is quoted, quotes doubled. */
function csv_line(values, delimiter) {
  const separator = delimiter || ",";
  return (values || [])
    .map((value) => {
      const text = value === null || value === undefined ? "" : String(value);
      return /["\r\n]/.test(text) || text.includes(separator) ? `"${text.replace(/"/g, '""')}"` : text;
    })
    .join(separator);
}

module.exports = { parse_csv_text, parse_csv_file, csv_line, detect_delimiter };
