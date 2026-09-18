/**
 * An option flagged exclusive (like "Site not yet evaluated" or "None of the
 * above") stands alone: while it is ticked no other option can be, and
 * while any other option is ticked it cannot be. The renderer disables the
 * conflicting boxes and both validators refuse an answer that combines
 * them anyway.
 */
function all_options(field) {
  const own = Array.isArray(field && field.options) ? field.options : [];
  const grouped = (field && field.parent_option_groups ? field.parent_option_groups : []).flatMap((group) => (Array.isArray(group.options) ? group.options : []));
  return own.concat(grouped);
}

export function exclusive_values(field) {
  return all_options(field)
    .filter((option) => option && option.exclusive === true)
    .map((option) => option.value);
}

export function has_exclusive_conflict(field, value) {
  if (!Array.isArray(value) || value.length < 2) return false;
  const exclusive = exclusive_values(field);
  return value.some((entry) => exclusive.includes(entry));
}

/** Whether a given option box must be disabled under the current selection. */
export function is_option_blocked(field, option, selected) {
  const chosen = Array.isArray(selected) ? selected : [];
  if (chosen.length === 0 || chosen.includes(option.value)) return false;
  const exclusive = exclusive_values(field);
  if (option.exclusive === true) return true;
  return chosen.some((entry) => exclusive.includes(entry));
}

/** The selection after ticking one option: an exclusive one replaces everything else. */
export function next_selection(field, selected, option_value) {
  const chosen = Array.isArray(selected) ? selected : [];
  if (chosen.includes(option_value)) return chosen.filter((entry) => entry !== option_value);
  if (exclusive_values(field).includes(option_value)) return [option_value];
  return chosen.concat([option_value]);
}
