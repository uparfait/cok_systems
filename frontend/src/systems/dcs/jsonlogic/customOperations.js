const MAX_PATTERN_LENGTH = 200;

/**
 * Case-sensitive suffix check, tolerant of non-string inputs.
 */
function ends_with(value, suffix) {
  return String(value ?? "").endsWith(String(suffix ?? ""));
}

/**
 * Case-sensitive prefix check, tolerant of non-string inputs.
 */
function starts_with(value, prefix) {
  return String(value ?? "").startsWith(String(prefix ?? ""));
}

/**
 * An author pasting a pattern from anywhere else (a regex tester site, an
 * editor, documentation) almost always copies the full JS literal form -
 * "/^\d{10}$/i" - not just its bare body. Passed straight to `new RegExp`,
 * that literal's own leading/trailing slashes become part of the pattern
 * itself (now requiring an actual "/" character in the answer) and any
 * flags after the closing slash are silently dropped instead of applied -
 * so the rule always failed to match anything real. Splitting the literal
 * back into its body and flags here means both the JS-literal form and a
 * bare body ("^\d{10}$") work identically, wherever the pattern came from.
 */
function parse_regex_literal(raw_pattern) {
  const literal_match = /^\/(.*)\/([a-z]*)$/i.exec(raw_pattern);
  return literal_match ? { body: literal_match[1], flags: literal_match[2] } : { body: raw_pattern, flags: "" };
}

/**
 * Tests a value against a bounded-length regex pattern.
 */
function regex_match(value, pattern, flags) {
  const { body, flags: literal_flags } = parse_regex_literal(String(pattern ?? ""));
  if (body.length > MAX_PATTERN_LENGTH) return false;
  try {
    const regex = new RegExp(body, flags || literal_flags || "");
    return regex.test(String(value ?? ""));
  } catch (error) {
    return false;
  }
}

/**
 * Whole-number difference in days between two date-like values.
 */
function date_diff_days(date_a, date_b) {
  const first = new Date(date_a);
  const second = new Date(date_b);
  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return null;
  const ms_per_day = 24 * 60 * 60 * 1000;
  return Math.round((second.getTime() - first.getTime()) / ms_per_day);
}

/**
 * True when value is present in the given array (loose equality - option
 * ids are fixed system values, so this stays exact/case-sensitive), or -
 * when the haystack is a plain string rather than an array, as it is for
 * every text-like field - true when it appears as a substring, matched
 * case-insensitively so "must/must not contain claude" catches "Claude"
 * and "CLAUDE" too, not just an exact-case match. Without the string
 * branch this always returned false for text fields, which made every
 * "must not contain" rule built on its negation (not_in_array) vacuously
 * true.
 */
function in_array(value, array) {
  if (Array.isArray(array)) return array.some((item) => item == value);
  if (array === null || array === undefined) return false;
  return String(array).toLowerCase().indexOf(String(value).toLowerCase()) !== -1;
}

/**
 * True when a captured GPS accuracy (meters) is within the allowed
 * threshold for the field.
 */
function gps_accuracy_ok(accuracy_meters, threshold_meters) {
  const accuracy = Number(accuracy_meters);
  const threshold = Number(threshold_meters);
  if (Number.isNaN(accuracy) || Number.isNaN(threshold)) return false;
  return accuracy <= threshold;
}

/**
 * True when the string/array length of a value exactly matches length.
 */
function length_is(value, length) {
  if (value === null || value === undefined) return false;
  const actual = Array.isArray(value) ? value.length : String(value).length;
  return actual === Number(length);
}

/**
 * True when the string/array length of a value is at least minimum.
 */
function min_length(value, minimum) {
  if (value === null || value === undefined) return false;
  const actual = Array.isArray(value) ? value.length : String(value).length;
  return actual >= Number(minimum);
}

/**
 * True when the string/array length of a value is at most maximum.
 */
function max_length(value, maximum) {
  if (value === null || value === undefined) return true;
  const actual = Array.isArray(value) ? value.length : String(value).length;
  return actual <= Number(maximum);
}

/**
 * True when value is absent from the given array - the negation of
 * in_array, used for "must not contain one of these" rules.
 */
function not_in_array(value, array) {
  return !in_array(value, array);
}

/**
 * Word count of a text value: runs of non-whitespace separated by any
 * whitespace, so extra spaces/newlines between words never inflate the
 * count.
 */
function count_words(value) {
  if (value === null || value === undefined) return 0;
  const trimmed = String(value).trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/**
 * True when the word count of a value exactly matches count.
 */
function words_is(value, count) {
  if (value === null || value === undefined) return false;
  return count_words(value) === Number(count);
}

/**
 * True when the word count of a value is at least minimum.
 */
function min_words(value, minimum) {
  if (value === null || value === undefined) return false;
  return count_words(value) >= Number(minimum);
}

/**
 * True when the word count of a value is at most maximum.
 */
function max_words(value, maximum) {
  if (value === null || value === undefined) return true;
  return count_words(value) <= Number(maximum);
}

/**
 * Lower-cased, trimmed comma-separated list, used by every domain-matching
 * operation below.
 */
function parse_csv_list(csv) {
  return String(csv ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The domain portion of an email address, or an empty string when it has
 * no "@" at all.
 */
function get_email_domain(email) {
  const parts = String(email ?? "").split("@");
  return parts.length === 2 ? parts[1].toLowerCase() : "";
}

/**
 * The hostname of a URL, or an empty string when it cannot be parsed.
 */
function get_url_domain(url) {
  try {
    return new URL(String(url ?? "")).hostname.toLowerCase();
  } catch (error) {
    return "";
  }
}

function email_domain_in(email, domains_csv) {
  return parse_csv_list(domains_csv).includes(get_email_domain(email));
}

function email_domain_not_in(email, domains_csv) {
  return !email_domain_in(email, domains_csv);
}

function url_domain_in(url, domains_csv) {
  return parse_csv_list(domains_csv).includes(get_url_domain(url));
}

function url_domain_not_in(url, domains_csv) {
  return !url_domain_in(url, domains_csv);
}

export const dcs_custom_operations = {
  ends_with,
  starts_with,
  regex_match,
  date_diff_days,
  in_array,
  not_in_array,
  gps_accuracy_ok,
  length_is,
  min_length,
  max_length,
  words_is,
  min_words,
  max_words,
  email_domain_in,
  email_domain_not_in,
  url_domain_in,
  url_domain_not_in,
};
