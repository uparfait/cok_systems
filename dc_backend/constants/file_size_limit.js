/**
 * Units a designer can express a media field's maximum file size in -
 * mirrors frontend/src/systems/dcs/fields/fileSizeLimit.js exactly.
 */
const FILE_SIZE_UNITS = {
  kb: 1024,
  mb: 1024 * 1024,
  gb: 1024 * 1024 * 1024,
};

/**
 * Converts a field's designer-authored max size into a byte threshold, or
 * null for "no limit" - re-validated here exactly like the upload endpoint
 * already enforces client-side, since a tampered client could otherwise
 * upload past whatever cap the designer actually configured. A field with
 * no value set is unlimited by default - never enforced unless the
 * designer explicitly typed a number. max_size_mb (a bare, unit-less
 * megabyte number) is read as a fallback for a field configured before the
 * unit selector existed.
 */
function get_max_size_bytes(field) {
  if (!field) return null;
  if (field.max_size_value) {
    const multiplier = FILE_SIZE_UNITS[field.max_size_unit] || FILE_SIZE_UNITS.mb;
    return field.max_size_value * multiplier;
  }
  if (field.max_size_mb) {
    return field.max_size_mb * FILE_SIZE_UNITS.mb;
  }
  return null;
}

module.exports = { FILE_SIZE_UNITS, get_max_size_bytes };
