const { translate } = require("../i18n/index.js");
const { all_options, is_api_sourced, GEO_PARTS } = require("./import_fields.js");
const { get_field_text } = require("./export_columns.js");

/**
 * Turns the text of a CSV cell into the value a submission stores for a
 * field, with the same shapes the public form writes: numbers as numbers,
 * a multi choice as a list of option values, a date as YYYY-MM-DD, a time
 * as HH:MM, a duration as { hours, minutes }, a file answer as a link,
 * a location as the marked object the map field writes. Anything that
 * cannot be read is an error naming what was wrong; an empty cell is
 * "no answer" and falls to the field's own empty-value default.
 */
const LIST_TYPES = ["multi_select", "ranking"];
const CHOICE_TYPES = ["single_select", "select_group", "cascading_select"];
const MEDIA_TYPES = ["image", "video", "audio", "file_upload", "signature"];
const LANGUAGES = ["en", "kn", "fr"];

const pad_two = (value) => String(value).padStart(2, "0");
const is_blank = (value) => value === undefined || value === null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0);

function fail(key, value, language, vars) {
  return { error: translate(key, language, Object.assign({ value: String(value === undefined || value === null ? "" : value) }, vars || {})) };
}

function to_number(text) {
  const cleaned = String(text).trim().replace(/\s+/g, "");
  const direct = Number(cleaned);
  if (cleaned !== "" && Number.isFinite(direct)) return direct;
  if (/^-?\d+,\d+$/.test(cleaned)) return Number(cleaned.replace(",", "."));
  return NaN;
}

function match_option(field, text) {
  const options = all_options(field);
  const needle = String(text).trim();
  const lower = needle.toLowerCase();
  const by_value = options.find((option) => String(option.value) === needle) || options.find((option) => String(option.value).toLowerCase() === lower);
  if (by_value) return by_value.value;
  const by_label = options.find((option) => LANGUAGES.some((code) => String(get_field_text(option.label, code) || "").trim().toLowerCase() === lower));
  return by_label ? by_label.value : undefined;
}

function convert_choice(field, text, language) {
  const matched = match_option(field, text);
  if (matched !== undefined) return { value: matched };
  if (is_api_sourced(field) || all_options(field).length === 0) return { value: String(text).trim() };
  return fail("IMPORT_VALUE_NOT_OPTION", text, language);
}

function convert_list(field, raw, language) {
  const parts = Array.isArray(raw) ? raw.map((entry) => String(entry)) : String(raw).trim() !== "" && match_option(field, raw) !== undefined ? [String(raw)] : String(raw).split(/[,;|]/);
  const values = [];
  for (const part of parts) {
    if (String(part).trim() === "") continue;
    const converted = convert_choice(field, part, language);
    if (converted.error) return converted;
    if (!values.includes(converted.value)) values.push(converted.value);
  }
  return { value: values };
}

function convert_date(text, language) {
  const trimmed = String(text).trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  const date = iso ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) : new Date(trimmed);
  if (Number.isNaN(date.getTime()) || (iso && (date.getMonth() !== Number(iso[2]) - 1 || date.getDate() !== Number(iso[3])))) return fail("IMPORT_VALUE_NOT_DATE", text, language);
  return { value: `${date.getFullYear()}-${pad_two(date.getMonth() + 1)}-${pad_two(date.getDate())}` };
}

function convert_time(text, language) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(text).trim());
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return fail("IMPORT_VALUE_NOT_TIME", text, language);
  return { value: `${pad_two(match[1])}:${match[2]}` };
}

function convert_date_time(text, language) {
  const trimmed = String(text).trim();
  const match = /^(\d{4}-\d{1,2}-\d{1,2})[T ](\d{1,2}:\d{2})(?::\d{2})?/.exec(trimmed);
  if (match) {
    const date = convert_date(match[1], language);
    const time = convert_time(match[2], language);
    if (date.error || time.error) return fail("IMPORT_VALUE_NOT_DATE_TIME", text, language);
    return { value: `${date.value}T${time.value}` };
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return fail("IMPORT_VALUE_NOT_DATE_TIME", text, language);
  return { value: `${date.getFullYear()}-${pad_two(date.getMonth() + 1)}-${pad_two(date.getDate())}T${pad_two(date.getHours())}:${pad_two(date.getMinutes())}` };
}

function convert_duration(raw, language) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const hours = to_number(raw.hours || 0);
    const minutes = to_number(raw.minutes || 0);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fail("IMPORT_VALUE_NOT_DURATION", JSON.stringify(raw), language);
    return { value: { hours: String(hours), minutes: String(minutes) } };
  }
  const text = String(raw).trim();
  if (text.startsWith("{")) {
    try {
      return convert_duration(JSON.parse(text), language);
    } catch (error) {
      return fail("IMPORT_VALUE_NOT_DURATION", text, language);
    }
  }
  const clock = /^(\d+):(\d{1,2})$/.exec(text);
  if (clock) return { value: { hours: String(Number(clock[1])), minutes: String(Number(clock[2])) } };
  const minutes = to_number(text);
  if (!Number.isFinite(minutes) || minutes < 0) return fail("IMPORT_VALUE_NOT_DURATION", text, language);
  return { value: { hours: String(Math.floor(minutes / 60)), minutes: String(Math.round(minutes % 60)) } };
}

function convert_media(text, language) {
  const url = String(text).trim();
  if (!/^(https?:\/\/|\/)/i.test(url)) return fail("IMPORT_VALUE_NOT_URL", text, language);
  const name = url.split("?")[0].split("/").filter(Boolean).pop() || url;
  return { value: { name, type: "", size: 0, url, is_link: true } };
}

function convert_boolean(text, language) {
  const lower = String(text).trim().toLowerCase();
  if (["yes", "true", "1", "y", "oui", "yego"].includes(lower)) return { value: true };
  if (["no", "false", "0", "n", "non", "oya"].includes(lower)) return { value: false };
  return fail("IMPORT_VALUE_NOT_BOOLEAN", text, language);
}

/** One plain (non-location) cell for a field. { value } or { error }. */
function convert_cell(field, raw, language) {
  if (is_blank(raw)) return { value: undefined };
  switch (field.type) {
    case "number": {
      const number = to_number(raw);
      return Number.isFinite(number) ? { value: number } : fail("IMPORT_VALUE_NOT_NUMBER", raw, language);
    }
    case "likert_scale": {
      const number = to_number(raw);
      const size = Number(field.scale_size) || 5;
      return Number.isInteger(number) && number >= 1 && number <= size ? { value: number } : fail("IMPORT_VALUE_NOT_SCALE", raw, language, { max: size });
    }
    case "date":
      return convert_date(raw, language);
    case "time":
      return convert_time(raw, language);
    case "date_time":
      return convert_date_time(raw, language);
    case "duration":
      return convert_duration(raw, language);
    case "boolean":
    case "yes_no":
      return typeof raw === "boolean" ? { value: raw } : convert_boolean(raw, language);
    default:
      if (CHOICE_TYPES.includes(field.type)) return convert_choice(field, raw, language);
      if (LIST_TYPES.includes(field.type)) return convert_list(field, raw, language);
      if (MEDIA_TYPES.includes(field.type)) return typeof raw === "object" ? { value: raw } : convert_media(raw, language);
      return { value: Array.isArray(raw) ? raw.join(", ") : String(raw).trim() };
  }
}

/**
 * A location from its three parts (each text or a number), or from the
 * export's older single "lat, lng - address" cell. Both coordinates are
 * needed; accuracy may be missing. Nothing at all is "no answer".
 */
function convert_location(parts, whole, language) {
  const read = (key) => {
    const raw = parts[key];
    if (is_blank(raw)) return null;
    const number = to_number(raw);
    return Number.isFinite(number) ? number : NaN;
  };
  let latitude = read("latitude");
  let longitude = read("longitude");
  const accuracy = read("accuracy");
  let full_address = null;
  if (latitude === null && longitude === null && !is_blank(whole)) {
    const match = /^\s*(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)\s*(?:-\s*(.*))?$/.exec(String(whole));
    if (!match) return fail("IMPORT_VALUE_NOT_COORDINATE", whole, language);
    latitude = to_number(match[1]);
    longitude = to_number(match[2]);
    full_address = match[3] ? match[3].trim() : null;
  }
  if (latitude === null && longitude === null && accuracy === null) return { value: undefined };
  if (latitude === null || longitude === null) return fail("IMPORT_LOCATION_INCOMPLETE", "", language);
  if (Number.isNaN(latitude) || Number.isNaN(longitude) || Number.isNaN(accuracy)) return fail("IMPORT_VALUE_NOT_COORDINATE", [parts.latitude, parts.longitude, parts.accuracy].filter((entry) => !is_blank(entry)).join(", "), language);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return fail("IMPORT_VALUE_NOT_COORDINATE", `${latitude}, ${longitude}`, language);
  return {
    value: {
      __map__location__data: true,
      latitude,
      longitude,
      accuracy,
      province: null,
      district: null,
      sector: null,
      cell: null,
      village: null,
      street: null,
      full_address,
      is_manual: true,
    },
  };
}

module.exports = { GEO_PARTS, is_blank, convert_cell, convert_location, match_option };
