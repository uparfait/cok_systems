const RESPONDENT_KEY = "dcs_respondent";
const MAX_LENGTH = 120;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{7,17}$/;

/**
 * Who is filling forms in on this device: name, email and telephone, kept
 * in localStorage (it survives every visit and needs no IndexedDB) and
 * attached to every response the device sends.
 */
function local_storage() {
  try {
    return window.localStorage;
  } catch (storage_error) {
    return null;
  }
}

function clean(value) {
  return String(value === undefined || value === null ? "" : value).trim().slice(0, MAX_LENGTH);
}

export function normalize_respondent(raw) {
  if (!raw || typeof raw !== "object") return null;
  const respondent = { name: clean(raw.name), email: clean(raw.email).toLowerCase(), phone: clean(raw.phone).replace(/\s+/g, " ") };
  if (!respondent.name && !respondent.email && !respondent.phone) return null;
  return respondent;
}

export function read_respondent() {
  const storage = local_storage();
  if (!storage) return null;
  try {
    return normalize_respondent(JSON.parse(storage.getItem(RESPONDENT_KEY) || "null"));
  } catch (parse_error) {
    return null;
  }
}

export function save_respondent(raw) {
  const respondent = normalize_respondent(raw);
  const storage = local_storage();
  if (storage && respondent) storage.setItem(RESPONDENT_KEY, JSON.stringify(respondent));
  return respondent;
}

export function clear_respondent() {
  const storage = local_storage();
  if (storage) storage.removeItem(RESPONDENT_KEY);
}

/**
 * Field errors for the identity form, keyed by field: all three are
 * required, the email must look like one and the telephone must be digits
 * (an optional leading plus, spaces or dashes allowed).
 */
export function validate_respondent(raw, translate) {
  const respondent = normalize_respondent(raw) || { name: "", email: "", phone: "" };
  const errors = {};
  if (respondent.name.length < 2) errors.name = translate("DCS_RESPONDENT_NAME_REQUIRED");
  if (!EMAIL_PATTERN.test(respondent.email)) errors.email = translate("DCS_RESPONDENT_EMAIL_INVALID");
  if (!PHONE_PATTERN.test(respondent.phone)) errors.phone = translate("DCS_RESPONDENT_PHONE_INVALID");
  return { respondent, errors, valid: Object.keys(errors).length === 0 };
}

/** One line describing a respondent for tables and footers. */
export function format_respondent(respondent) {
  if (!respondent) return "";
  return [respondent.name, respondent.email, respondent.phone].filter(Boolean).join(" - ");
}
