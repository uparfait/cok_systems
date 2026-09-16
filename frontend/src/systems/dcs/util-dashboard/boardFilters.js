/**
 * Dashboard-level filters, the frontend half (the server's rules live in
 * dc_backend/util-dashboard/board_filters.js): which fields may filter a
 * board, which of them the widgets already use, and the applied values as
 * every data request carries them.
 *
 * Only fields answered from a fixed list qualify: a select or radio
 * (single_select), a cascading select (district -> sector) and a select
 * group. A value picked in a filter narrows EVERY widget; a widget grouped,
 * split or legended by that field drills down to its cascade child or
 * collapses to the one value (the server reshapes it and reports the
 * change back as the widget's board_context).
 */

export const FILTER_FIELD_TYPES = ["single_select", "cascading_select", "select_group"];
export const MAX_BOARD_FILTERS = 8;

/** The builder fields of a form that may become board filters. */
export function filter_candidates(fields) {
  return (fields || []).filter((field) => FILTER_FIELD_TYPES.includes(field.type));
}

/**
 * How many widgets read each field (as group, split, pattern, legend or
 * own filter) - a filter on such a field reshapes those widgets, so the
 * pickers mark them.
 */
export function filter_usage(widgets) {
  const usage = new Map();
  (widgets || []).forEach((widget) => {
    const ids = new Set();
    ["group_by", "split_by", "pattern_by", "legend_by"].forEach((role) => {
      if (widget[role] && widget[role].field_id) ids.add(widget[role].field_id);
    });
    (widget.filters || []).forEach((filter) => filter && filter.field_id && ids.add(filter.field_id));
    ids.forEach((id) => usage.set(id, (usage.get(id) || 0) + 1));
  });
  return usage;
}

export function field_label_of(fields, field_id) {
  const field = (fields || []).find((entry) => entry.id === field_id);
  return field ? field.label : field_id;
}

/** { field_id: value } -> [{ field_id, value }] with blanks dropped. */
export function applied_filter_list(values) {
  return Object.entries(values || {})
    .filter(([, value]) => value !== "" && value !== null && value !== undefined)
    .map(([field_id, value]) => ({ field_id, value }));
}

/** [{ field_id, value }] -> { field_id: value }. */
export function applied_filter_map(list) {
  return Object.fromEntries((list || []).map((entry) => [entry.field_id, entry.value]));
}

/** Adds or removes one field in a filter definition list, within the limit. */
export function toggle_filter_def(defs, field_id) {
  const current = defs || [];
  if (current.some((def) => def.field_id === field_id)) return current.filter((def) => def.field_id !== field_id);
  if (current.length >= MAX_BOARD_FILTERS) return current;
  return current.concat([{ field_id }]);
}

export const same_filter_defs = (a, b) => JSON.stringify((a || []).map((def) => def.field_id)) === JSON.stringify((b || []).map((def) => def.field_id));
