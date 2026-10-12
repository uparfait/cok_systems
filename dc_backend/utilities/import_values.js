const { translate } = require("../i18n/index.js");
const { all_options, is_api_sourced, GEO_PARTS } = require("./import_fields.js");
const { get_field_text } = require("./export_columns.js");
const location_levels = require("./location_levels.js");
const { best_match } = require("./import_similarity.js");
const { clean_text, normalize_key, parse_number, pad_two, format_utc_date, format_utc_time, excel_serial_of, excel_serial_to_date } = require("./import_text.js");

/**
 * Turns the text of a cell into the value a submission stores for a
 * field, with the shapes the public form writes: numbers as numbers
 * (thousand separators and decimal commas read), a choice as its option
 * value (typed as the value or as the label in any language, case and
 * stray spaces ignored), a multi choice as a list, a date as YYYY-MM-DD
 * (ISO, dd/mm/yyyy - day first is the assumed order -, or an Excel
 * serial), a time as HH:MM, a duration as { hours, minutes }, a file
 * answer as a link, a location as the marked object the map field
 * writes. Anything unreadable is an error naming what was wrong; an
 * empty cell is "no answer" and falls to the field's own default.
 */
const LIST_TYPES = ["multi_select", "ranking"];
const CHOICE_TYPES = ["single_select", "select_group", "cascading_select"];
const MEDIA_TYPES = ["image", "video", "audio", "file_upload", "signature"];
const LANGUAGES = ["en", "kn", "fr"];
const YES_WORDS = ["yes", "true", "1", "y", "oui", "yego"];
const NO_WORDS = ["no", "false", "0", "n", "non", "oya"];

const is_blank = (value) => value === undefined || value === null || (typeof value === "string" && clean_text(value) === "") || (Array.isArray(value) && value.length === 0);

function fail(key, value, language, vars) {
  return { error: translate(key, language, Object.assign({ value: clean_text(value) }, vars || {})) };
}

const to_number = (raw) => parse_number(raw);

/** A note for the run: what was typed and what it was saved as, when the two differ. */
const note_of = (typed, label) => ({ from: clean_text(typed), to: String(label) });

/** { value, label, texts } per option: the label in the import language, every spelling to compare with. */
function option_candidates(field, language) {
  return all_options(field).map((option) => ({
    value: option.value,
    label: get_field_text(option.label, language) || String(option.value),
    texts: [String(option.value)].concat(LANGUAGES.map((code) => get_field_text(option.label, code)).filter(Boolean)),
  }));
}

/**
 * One typed choice against a field's options: exact (value, or label in
 * any language, case and stray spaces aside), then without punctuation,
 * then by similarity (utilities/import_similarity.js). Returns { value,
 * label, exact } or undefined. The value is always the option's own.
 */
function resolve_option(field, text, language) {
  const candidates = option_candidates(field, language);
  const needle = clean_text(text);
  const key = normalize_key(text);
  const exact = candidates.find((candidate) => String(candidate.value) === needle) || candidates.find((candidate) => candidate.texts.some((entry) => normalize_key(entry) === key));
  if (exact) return { value: exact.value, label: exact.label, exact: true };
  const found = best_match(text, candidates);
  return found ? { value: found.candidate.value, label: found.candidate.label, exact: false } : undefined;
}

/** The option value a typed choice resolves to (any stage), or undefined. */
function match_option(field, text) {
  const found = resolve_option(field, text, "en");
  return found ? found.value : undefined;
}

/** An API-sourced location: whatever spelling, translation or near-spelling was typed becomes the name a submission stores. */
function convert_location_choice(field, text) {
  const typed = clean_text(text);
  const level = (field.data_source && field.data_source.level) || "provinces";
  let found = null;
  try {
    found = location_levels.resolve_location_name(level, typed);
  } catch (error) {
    found = null;
  }
  if (!found) return { value: typed };
  return found.exact ? { value: found.name } : { value: found.name, notes: [note_of(typed, found.name)] };
}

function convert_choice(field, text, language) {
  if (is_api_sourced(field)) return convert_location_choice(field, text);
  const found = resolve_option(field, text, language);
  if (found) return found.exact ? { value: found.value } : { value: found.value, notes: [note_of(text, found.label)] };
  if (all_options(field).length === 0) return { value: clean_text(text) };
  return fail("IMPORT_VALUE_NOT_OPTION", text, language);
}

/**
 * The pieces of a multi-value cell: split on ";" (or "|") when either is
 * there - a label may itself hold commas ("Livestock (cows, goats, pigs)");
 * without them the whole cell is tried as ONE option first, and only a
 * cell that matches nothing is split on commas for people who separated
 * with commas.
 */
function split_multi(field, text) {
  const trimmed = clean_text(text);
  if (trimmed === "") return [];
  if (/[;|]/.test(trimmed)) return trimmed.split(/[;|]/);
  if (match_option(field, trimmed) !== undefined) return [trimmed];
  return trimmed.split(",");
}

function convert_list(field, raw, language) {
  const parts = Array.isArray(raw) ? raw.map((entry) => String(entry)) : split_multi(field, raw);
  const values = [];
  const notes = [];
  for (const part of parts) {
    if (clean_text(part) === "") continue;
    const converted = convert_choice(field, part, language);
    if (converted.error) return converted;
    if (!values.includes(converted.value)) values.push(converted.value);
    if (converted.notes) notes.push(...converted.notes);
  }
  return notes.length > 0 ? { value: values, notes } : { value: values };
}

/** { year, month, day } of a date text: ISO, dd/mm/yyyy (day first), an Excel serial, else what Date can parse. */
function read_date_parts(raw) {
  const text = clean_text(raw);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(text);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  const day_first = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:[T ].*)?$/.exec(text);
  if (day_first) return { year: Number(day_first[3]), month: Number(day_first[2]), day: Number(day_first[1]) };
  const serial = excel_serial_of(typeof raw === "number" ? raw : text);
  if (serial !== null && serial >= 1) {
    const date = excel_serial_to_date(Math.floor(serial));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return { year: parsed.getFullYear(), month: parsed.getMonth() + 1, day: parsed.getDate() };
}

function convert_date(raw, language) {
  const parts = read_date_parts(raw);
  if (!parts) return fail("IMPORT_VALUE_NOT_DATE", raw, language);
  const check = new Date(parts.year, parts.month - 1, parts.day);
  if (check.getMonth() !== parts.month - 1 || check.getDate() !== parts.day || parts.year < 1900) return fail("IMPORT_VALUE_NOT_DATE", raw, language);
  return { value: `${parts.year}-${pad_two(parts.month)}-${pad_two(parts.day)}` };
}

/** HH:MM of a time text ("9:30", "09:30:15", the time part of a date-time, or an Excel fraction of a day). */
function read_time(raw) {
  const text = clean_text(raw);
  const clock = /(?:^|[T ])(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([ap])\.?m\.?)?$/i.exec(text);
  if (clock) {
    let hours = Number(clock[1]);
    const meridian = clock[3] ? clock[3].toLowerCase() : "";
    if (meridian === "p" && hours < 12) hours += 12;
    if (meridian === "a" && hours === 12) hours = 0;
    return hours > 23 || Number(clock[2]) > 59 ? null : `${pad_two(hours)}:${clock[2]}`;
  }
  const serial = excel_serial_of(typeof raw === "number" ? raw : text);
  if (serial !== null && serial < 1) return format_utc_time(excel_serial_to_date(serial));
  return null;
}

function convert_time(raw, language) {
  const value = read_time(raw);
  return value ? { value } : fail("IMPORT_VALUE_NOT_TIME", raw, language);
}

function convert_date_time(raw, language) {
  const text = clean_text(raw);
  const serial = excel_serial_of(typeof raw === "number" ? raw : text);
  if (serial !== null && serial >= 1) {
    const date = excel_serial_to_date(serial);
    return { value: `${format_utc_date(date)}T${format_utc_time(date)}` };
  }
  const date = convert_date(text, language);
  const time = read_time(text);
  if (date.error || !time) {
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return fail("IMPORT_VALUE_NOT_DATE_TIME", raw, language);
    return { value: `${parsed.getFullYear()}-${pad_two(parsed.getMonth() + 1)}-${pad_two(parsed.getDate())}T${pad_two(parsed.getHours())}:${pad_two(parsed.getMinutes())}` };
  }
  return { value: `${date.value}T${time}` };
}

function convert_duration(raw, language) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const hours = to_number(raw.hours || 0);
    const minutes = to_number(raw.minutes || 0);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fail("IMPORT_VALUE_NOT_DURATION", JSON.stringify(raw), language);
    return { value: { hours: String(hours), minutes: String(minutes) } };
  }
  const text = clean_text(raw);
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
  const url = clean_text(text);
  if (!/^(https?:\/\/|\/)/i.test(url)) return fail("IMPORT_VALUE_NOT_URL", text, language);
  const name = url.split("?")[0].split("/").filter(Boolean).pop() || url;
  return { value: { name, type: "", size: 0, url, is_link: true } };
}

function convert_boolean(text, language) {
  const key = normalize_key(text);
  if (YES_WORDS.includes(key)) return { value: true };
  if (NO_WORDS.includes(key)) return { value: false };
  const found = best_match(text, [
    { value: true, label: translate("IMPORT_OPTION_YES", language), texts: YES_WORDS },
    { value: false, label: translate("IMPORT_OPTION_NO", language), texts: NO_WORDS },
  ]);
  if (found) return { value: found.candidate.value, notes: [note_of(text, found.candidate.label)] };
  return fail("IMPORT_VALUE_NOT_BOOLEAN", text, language);
}

/** A scale answer: its number, a "3 - label" cell, or the scale's own low / high label (exact or near). */
function convert_likert(field, raw, language) {
  const size = Number(field.scale_size) || 5;
  const number = to_number(raw);
  const leading = Number.isFinite(number) ? number : Number((/^(\d+)\s*[-:]/.exec(clean_text(raw)) || [])[1]);
  if (Number.isInteger(leading) && leading >= 1 && leading <= size) return { value: leading };
  const label_texts = (label) => LANGUAGES.map((code) => get_field_text(label, code)).filter(Boolean);
  const candidates = [
    { value: 1, label: get_field_text(field.low_label, language) || "1", texts: label_texts(field.low_label) },
    { value: size, label: get_field_text(field.high_label, language) || String(size), texts: label_texts(field.high_label) },
  ].filter((candidate) => candidate.texts.length > 0);
  const key = normalize_key(raw);
  const exact = candidates.find((candidate) => candidate.texts.some((entry) => normalize_key(entry) === key));
  if (exact) return { value: exact.value };
  const found = best_match(raw, candidates);
  if (found) return { value: found.candidate.value, notes: [note_of(raw, found.candidate.label)] };
  return fail("IMPORT_VALUE_NOT_SCALE", raw, language, { max: size });
}

/** One plain (non-location) cell for a field. { value } or { error }. */
function convert_cell(field, raw, language) {
  if (is_blank(raw)) return { value: undefined };
  switch (field.type) {
    case "number": {
      const number = to_number(raw);
      return Number.isFinite(number) ? { value: number } : fail("IMPORT_VALUE_NOT_NUMBER", raw, language);
    }
    case "likert_scale":
      return convert_likert(field, raw, language);
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
    case "email": {
      const email = clean_text(raw);
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { value: email } : fail("IMPORT_VALUE_NOT_EMAIL", raw, language);
    }
    case "url": {
      const url = clean_text(raw);
      return /^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(url) ? { value: url } : fail("IMPORT_VALUE_NOT_URL", raw, language);
    }
    default:
      if (CHOICE_TYPES.includes(field.type)) return convert_choice(field, raw, language);
      if (LIST_TYPES.includes(field.type)) return convert_list(field, raw, language);
      if (MEDIA_TYPES.includes(field.type)) return typeof raw === "object" ? { value: raw } : convert_media(raw, language);
      return { value: Array.isArray(raw) ? raw.map(clean_text).join(", ") : clean_text(raw) };
  }
}

/**
 * A location from its three parts (each text or a number), or from the
 * export's older single "lat, lng - address" cell. Both coordinates are
 * needed, inside -90..90 and -180..180; accuracy may be missing. Nothing
 * at all is "no answer".
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
    const match = /^\s*(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)\s*(?:-\s*(.*))?$/.exec(clean_text(whole));
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

module.exports = { GEO_PARTS, is_blank, convert_cell, convert_location, match_option, resolve_option, split_multi, read_date_parts, read_time };
