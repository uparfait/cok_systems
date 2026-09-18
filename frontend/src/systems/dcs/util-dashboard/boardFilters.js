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

export const FILTER_FIELD_TYPES = ["single_select", "multi_select", "cascading_select", "select_group"];
export const MAX_BOARD_FILTERS = 8;

/** A field may filter the board when its answers come from a fixed list, or when the form derives it itself. */
export const can_filter_field = (field) => !!field && (FILTER_FIELD_TYPES.includes(field.type) || field.is_derived === true || (field.type === "hidden" && !!field.computed && field.computed.enabled === true));

/** The builder fields of a form that may become board filters. */
export function filter_candidates(fields) {
  return (fields || []).filter((field) => can_filter_field(field));
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

/**
 * The cascade parent of a filter field, when it has one: a cascading select
 * points at its parent field, a parent-dependent select group at the field
 * its option groups follow. Works on builder fields (raw schema attached)
 * and on the public page's plain { id, type, label, parent_field_id }.
 */
export function parent_filter_of(field) {
  if (!field) return null;
  if (field.parent_field_id) return field.parent_field_id;
  const raw = field.raw;
  if (!raw) return null;
  if (raw.parent_field_id) return raw.parent_field_id;
  if (raw.type === "select_group" && raw.parent_dependency_enabled) {
    const group = (raw.parent_option_groups || []).find((entry) => entry && entry.parent_field_id);
    if (group) return group.parent_field_id;
  }
  return null;
}

/** Every filter below this one in the cascade (its child, that child's child...). */
export function descendant_filters(defs, fields, field_id) {
  const by_id = new Map((fields || []).map((field) => [field.id, field]));
  const ids = new Set((defs || []).map((def) => def.field_id));
  const out = [];
  let frontier = [field_id];
  while (frontier.length > 0) {
    const next = [];
    ids.forEach((id) => {
      const parent = parent_filter_of(by_id.get(id));
      if (parent && frontier.includes(parent) && !out.includes(id)) {
        out.push(id);
        next.push(id);
      }
    });
    frontier = next;
  }
  return out;
}

export const same_filter_defs = (a, b) => JSON.stringify((a || []).map((def) => def.field_id)) === JSON.stringify((b || []).map((def) => def.field_id));
