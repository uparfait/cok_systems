const MAX_LENGTH = 120;

function clean(value) {
  return String(value === undefined || value === null ? "" : value).trim().slice(0, MAX_LENGTH);
}

/**
 * Who filled a response in, as the public page sends it: plain trimmed
 * strings (name, email, phone), never anything else the client may have
 * put on the object. Null when nothing usable was sent.
 */
function sanitize_respondent(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const respondent = {
    name: clean(raw.name),
    email: clean(raw.email).toLowerCase(),
    phone: clean(raw.phone).replace(/\s+/g, " "),
  };
  if (!respondent.name && !respondent.email && !respondent.phone) return null;
  return respondent;
}

/** One line for tables and exports: "name - email - phone". */
function format_respondent(respondent) {
  if (!respondent || typeof respondent !== "object") return "";
  return [respondent.name, respondent.email, respondent.phone].filter(Boolean).join(" - ");
}

module.exports = { sanitize_respondent, format_respondent };
