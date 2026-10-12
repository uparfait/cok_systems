const { clean_text, normalize_key } = require("./import_text.js");

/**
 * The table rules every import file obeys, CSV or Excel, once its lines
 * are plain strings: row 1 is the header row; a column whose header is
 * empty is ignored (so trailing empty columns vanish); a header that
 * appears twice is refused, naming it; fully empty rows are skipped and
 * not counted; every row keeps the number the spreadsheet shows for it
 * (header = 1, first data row = 2) so a message can point at it; a file
 * with more data rows than max_rows is refused.
 */
function import_error(code, vars) {
  const error = new Error(code);
  error.code = code;
  error.vars = vars || {};
  return error;
}

function normalize_table(raw_lines, raw_numbers, options) {
  const lines = (raw_lines || []).map((line) => (line || []).map(clean_text));
  const numbers = raw_numbers || lines.map((line, index) => index + 1);
  if (lines.length === 0 || numbers[0] !== 1) return { headers: [], rows: [], row_numbers: [] };

  const header_line = lines[0];
  const keep = [];
  header_line.forEach((header, index) => {
    if (header !== "") keep.push(index);
  });
  const headers = keep.map((index) => header_line[index]);
  if (headers.length === 0) return { headers: [], rows: [], row_numbers: [] };

  const seen = new Set();
  headers.forEach((header) => {
    const key = normalize_key(header);
    if (seen.has(key)) throw import_error("IMPORT_DUPLICATE_HEADER", { header });
    seen.add(key);
  });

  const rows = [];
  const row_numbers = [];
  for (let index = 1; index < lines.length; index += 1) {
    const cells = keep.map((column) => (lines[index][column] === undefined ? "" : lines[index][column]));
    if (cells.every((cell) => cell === "")) continue;
    rows.push(cells);
    row_numbers.push(numbers[index]);
  }
  const max_rows = options && options.max_rows;
  if (max_rows && rows.length > max_rows) throw import_error("IMPORT_TOO_MANY_ROWS", { count: rows.length, max: max_rows });
  return { headers, rows, row_numbers };
}

module.exports = { import_error, normalize_table };
