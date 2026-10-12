/**
 * Text and number clean-up shared by the import's readers and converters:
 * what a spreadsheet cell or a CSV field holds is never trusted to be
 * tidy. Every cell and header goes through clean_text; option matching
 * compares normalize_key of both sides; numbers typed as text with
 * thousand separators or a decimal comma go through parse_number.
 */
const ZERO_WIDTH = /[​‌‍⁠﻿]/g;
const ODD_SPACES = /[   -   　]/g;
const SINGLE_QUOTES = /[‘’‚‛′´]/g;
const DOUBLE_QUOTES = /[“”„‟″]/g;

const EXCEL_EPOCH_1900 = Date.UTC(1899, 11, 30);
const EXCEL_EPOCH_1904 = Date.UTC(1904, 0, 1);
const MAX_EXCEL_SERIAL = 2958465;
const DAY_MS = 86400000;

function clean_text(value) {
  if (value === undefined || value === null) return "";
  return String(value).replace(ZERO_WIDTH, "").replace(ODD_SPACES, " ").replace(SINGLE_QUOTES, "'").replace(DOUBLE_QUOTES, '"').replace(/\s+/g, " ").trim();
}

const normalize_key = (value) => clean_text(value).toLowerCase();

/**
 * A number from text: "1,234.5", "1 234,5", "1.234,5", "1,5", "2,000",
 * "-12" all read; when both separators appear the last one is the
 * decimal point; a lone comma is a thousands separator only when it is
 * followed by exactly three digits after one to three leading digits.
 */
function parse_number(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  if (typeof raw !== "string" && typeof raw !== "object") return NaN;
  let text = clean_text(raw).replace(/ /g, "").replace(/^\+/, "");
  if (text === "") return NaN;
  if (/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(text)) return Number(text);
  const commas = (text.match(/,/g) || []).length;
  const dots = (text.match(/\./g) || []).length;
  if (commas > 0 && dots > 0) {
    const decimal = text.lastIndexOf(",") > text.lastIndexOf(".") ? "," : ".";
    text = text.split(decimal === "," ? "." : ",").join("");
    if (decimal === ",") text = text.replace(",", ".");
  } else if (commas > 0) {
    const thousands = commas > 1 || (/^-?\d{1,3},\d{3}$/.test(text));
    text = thousands ? text.split(",").join("") : text.replace(",", ".");
  } else if (dots > 1) {
    text = text.split(".").join("");
  }
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : NaN;
}

const pad_two = (value) => String(value).padStart(2, "0");

/** YYYY-MM-DD of a Date read in UTC (how ExcelJS and the serial conversion hand dates over). */
function format_utc_date(date) {
  return `${date.getUTCFullYear()}-${pad_two(date.getUTCMonth() + 1)}-${pad_two(date.getUTCDate())}`;
}

function format_utc_time(date) {
  return `${pad_two(date.getUTCHours())}:${pad_two(date.getUTCMinutes())}`;
}

/** True when the value is an Excel date serial (a number, or digits as text) inside Excel's own range. */
function excel_serial_of(raw) {
  const number = typeof raw === "number" ? raw : /^\d+(\.\d+)?$/.test(clean_text(raw)) ? Number(clean_text(raw)) : NaN;
  return Number.isFinite(number) && number >= 0 && number <= MAX_EXCEL_SERIAL ? number : null;
}

/** The Date (UTC fields) of an Excel serial, in the 1900 system unless date1904 is set. */
function excel_serial_to_date(serial, date1904) {
  const epoch = date1904 ? EXCEL_EPOCH_1904 : EXCEL_EPOCH_1900;
  return new Date(epoch + Math.round(serial * DAY_MS));
}

/** True when a Date is Excel's own day zero - a time-only cell. */
function is_excel_epoch_day(date) {
  const time = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return time === EXCEL_EPOCH_1900 || time === EXCEL_EPOCH_1904 || time === EXCEL_EPOCH_1900 + DAY_MS;
}

module.exports = {
  MAX_EXCEL_SERIAL,
  clean_text,
  normalize_key,
  parse_number,
  pad_two,
  format_utc_date,
  format_utc_time,
  excel_serial_of,
  excel_serial_to_date,
  is_excel_epoch_day,
};
