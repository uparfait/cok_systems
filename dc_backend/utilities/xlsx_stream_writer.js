const fs = require("fs");
const { PassThrough } = require("stream");
const archiver = require("archiver");

/**
 * A minimal, fast .xlsx writer for one sheet of plain rows: the workbook
 * parts are written by hand and zipped on the fly (archiver), the sheet
 * XML is streamed row by row with inline strings, so memory stays flat and
 * no cell object is ever built. Styles are the handful the export needs:
 * 1 header (bold white on blue), 2 title (bold blue 14), 3 total (bold
 * blue 10), 4 note (italic gray).
 */
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const CONTENT_TYPES =
  XML_HEAD +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  "</Types>";
const ROOT_RELS =
  XML_HEAD +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  "</Relationships>";
const WORKBOOK_RELS =
  XML_HEAD +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  "</Relationships>";
const STYLES =
  XML_HEAD +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="5">' +
  '<font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="14"/><color rgb="FF056DAA"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="10"/><color rgb="FF056DAA"/><name val="Calibri"/></font>' +
  '<font><i/><sz val="11"/><color rgb="FF999999"/><name val="Calibri"/></font>' +
  "</fonts>" +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF056DAA"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="5">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  "</cellXfs>" +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

const FLUSH_BYTES = 64 * 1024;
// Control characters XML forbids (0-8, 11, 12, 14-31) and the two non-characters, built from codes so the source stays plain ASCII.
const INVALID_XML_CHARS = new RegExp("[" + String.fromCharCode(0) + "-" + String.fromCharCode(8) + String.fromCharCode(11) + String.fromCharCode(12) + String.fromCharCode(14) + "-" + String.fromCharCode(31) + String.fromCharCode(65534) + String.fromCharCode(65535) + "]", "g");

function escape_xml(text) {
  return String(text)
    .replace(INVALID_XML_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function column_letter(index) {
  let name = "";
  let n = index;
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

function workbook_xml(sheet_name) {
  return (
    XML_HEAD +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${escape_xml(sheet_name || "Data")}" sheetId="1" r:id="rId1"/></sheets></workbook>`
  );
}

class XlsxStreamWriter {
  constructor(file_path, options) {
    const settings = options || {};
    this.letters = [];
    this.row_number = 0;
    this.chunks = [];
    this.chunk_bytes = 0;
    this.output = fs.createWriteStream(file_path);
    // Level 6 measured fastest end to end (fewer bytes through the pipe) and smallest.
    this.archive = archiver("zip", { zlib: { level: settings.level === undefined ? 6 : settings.level } });
    this.finished = new Promise((resolve, reject) => {
      this.output.on("close", resolve);
      this.output.on("error", reject);
      this.archive.on("error", reject);
    });
    this.archive.pipe(this.output);
    this.archive.append(CONTENT_TYPES, { name: "[Content_Types].xml" });
    this.archive.append(ROOT_RELS, { name: "_rels/.rels" });
    this.archive.append(workbook_xml(settings.sheet_name), { name: "xl/workbook.xml" });
    this.archive.append(WORKBOOK_RELS, { name: "xl/_rels/workbook.xml.rels" });
    this.archive.append(STYLES, { name: "xl/styles.xml" });
    this.sheet = new PassThrough();
    this.archive.append(this.sheet, { name: "xl/worksheets/sheet1.xml" });
    const widths = Array.isArray(settings.widths) ? settings.widths : [];
    const cols = widths.length > 0 ? "<cols>" + widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${Number(width) || 22}" customWidth="1"/>`).join("") + "</cols>" : "";
    this.push(XML_HEAD + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + cols + "<sheetData>");
  }

  letter(index) {
    if (this.letters[index] === undefined) this.letters[index] = column_letter(index);
    return this.letters[index];
  }

  /** Buffers XML and hands it to the zip in large pieces; returns a promise only when the zip asks to wait. */
  push(xml) {
    this.chunks.push(xml);
    this.chunk_bytes += xml.length;
    if (this.chunk_bytes < FLUSH_BYTES) return null;
    return this.flush();
  }

  flush() {
    if (this.chunks.length === 0) return null;
    const ok = this.sheet.write(this.chunks.join(""));
    this.chunks = [];
    this.chunk_bytes = 0;
    return ok ? null : new Promise((resolve) => this.sheet.once("drain", resolve));
  }

  /**
   * One row: numbers as numeric cells, everything else as inline text,
   * empty values skipped. style is a cellXfs index (0 plain). Returns null,
   * or a promise to await when the writer needs a pause.
   */
  add_row(values, style) {
    this.row_number += 1;
    const r = this.row_number;
    const s = style ? ` s="${style}"` : "";
    let xml = `<row r="${r}">`;
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      if (value === undefined || value === null || value === "") continue;
      const ref = `${this.letter(index)}${r}`;
      if (typeof value === "number" && Number.isFinite(value)) xml += `<c r="${ref}"${s}><v>${value}</v></c>`;
      else xml += `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escape_xml(value)}</t></is></c>`;
    }
    xml += "</row>";
    return this.push(xml);
  }

  async finish() {
    this.push("</sheetData></worksheet>");
    const wait = this.flush();
    if (wait) await wait;
    this.sheet.end();
    await this.archive.finalize();
    await this.finished;
  }

  /** Stops early and leaves no half-written archive behind. */
  async abort() {
    try {
      this.archive.abort();
      this.output.destroy();
    } catch (error) {
      // Nothing left to release.
    }
  }
}

module.exports = { XlsxStreamWriter, escape_xml, column_letter };
