/**
 * Units a designer can express a media field's maximum file size in -
 * mirrors dc_backend/constants/file_size_limit.js exactly.
 */
export const DCS_FILE_SIZE_UNITS = [
  { key: "kb", labelKey: "DCS_FILE_SIZE_UNIT_KB", multiplier: 1024 },
  { key: "mb", labelKey: "DCS_FILE_SIZE_UNIT_MB", multiplier: 1024 * 1024 },
  { key: "gb", labelKey: "DCS_FILE_SIZE_UNIT_GB", multiplier: 1024 * 1024 * 1024 },
];

const DEFAULT_UNIT = "mb";

/**
 * Converts a field's designer-authored max size into a byte threshold, or
 * null for "no limit" - the only state the check below ever runs for. A
 * field with no value set is deliberately unlimited by default; this is
 * never enforced unless the designer explicitly typed a number.
 * max_size_mb (a bare, unit-less megabyte number) is read as a fallback for
 * a field configured before the unit selector existed.
 */
export function get_max_size_bytes(field) {
  if (!field) return null;
  if (field.max_size_value) {
    const unit = DCS_FILE_SIZE_UNITS.find((entry) => entry.key === field.max_size_unit) || DCS_FILE_SIZE_UNITS.find((entry) => entry.key === DEFAULT_UNIT);
    return field.max_size_value * unit.multiplier;
  }
  if (field.max_size_mb) {
    return field.max_size_mb * 1024 * 1024;
  }
  return null;
}
