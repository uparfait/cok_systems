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
 * Tests a value against a bounded-length regex pattern.
 */
function regex_match(value, pattern, flags) {
  const safe_pattern = String(pattern ?? "");
  if (safe_pattern.length > MAX_PATTERN_LENGTH) return false;
  try {
    const regex = new RegExp(safe_pattern, flags || "");
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
 * True when value is present in the given array.
 */
function in_array(value, array) {
  if (!Array.isArray(array)) return false;
  return array.some((item) => item == value);
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

export const dcs_custom_operations = {
  ends_with,
  starts_with,
  regex_match,
  date_diff_days,
  in_array,
  gps_accuracy_ok,
  length_is,
  min_length,
  max_length,
};
