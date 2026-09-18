/**
 * Mirrors frontend fields/exclusiveOptions.js: an option flagged exclusive
 * ("Site not yet evaluated", "None of the above") can never be submitted
 * together with another option of the same field, whatever the client sent.
 */
function all_options(field) {
  const own = Array.isArray(field && field.options) ? field.options : [];
  const grouped = (field && Array.isArray(field.parent_option_groups) ? field.parent_option_groups : []).flatMap((group) => (Array.isArray(group.options) ? group.options : []));
  return own.concat(grouped);
}

function exclusive_values(field) {
  return all_options(field)
    .filter((option) => option && option.exclusive === true)
    .map((option) => option.value);
}

function has_exclusive_conflict(field, value) {
  if (!Array.isArray(value) || value.length < 2) return false;
  const exclusive = exclusive_values(field);
  return value.some((entry) => exclusive.includes(entry));
}

module.exports = {
  exclusive_values,
  has_exclusive_conflict,
};
