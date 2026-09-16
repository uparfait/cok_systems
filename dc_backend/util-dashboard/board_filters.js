const { field_label_text, parent_field_id_of } = require("./field_catalog.js");

/**
 * Dashboard-level filters: the board carries a list of filter FIELDS (saved
 * with the dashboard) and, on every data request, the VALUES the viewer
 * picked for them. Every widget of the board follows every applied value.
 *
 * Only choice fields answered from a fixed list can be filters: a select or
 * radio (single_select), a cascading select (a district / sector chain) and
 * a select group. An applied value narrows the records of EVERY widget, and
 * reshapes the widgets built on that very field:
 * - a chart grouped by the filtered field drills down to the field's child
 *   in the cascade (district -> sector) so it keeps showing a breakdown;
 *   without a child it collapses to the one selected value;
 * - a split or pattern on the filtered field moves to the child too; with
 *   no child it simply keeps the one picked segment (the chart still draws,
 *   showing what exists);
 * - a KPI legend on the filtered field moves to the child, or disappears.
 * Every applied value is reported back as the widget's board_context (the
 * reshapings first), which the card appends to its title ("Records per
 * district (Kigali)") - so every widget shows the filters it runs under.
 */

const FILTER_FIELD_TYPES = ["single_select", "cascading_select", "select_group"];
const MAX_BOARD_FILTERS = 8;
const MAX_FILTER_VALUES = 200;
const DRILL_ROLES = ["group_by", "split_by", "pattern_by", "legend_by"];

const clean = (value) => (typeof value === "string" ? value.trim() : "");
const is_scalar = (value) => typeof value === "string" || typeof value === "number" || typeof value === "boolean";

/** The saved filter fields of a dashboard: [{ field_id }], deduplicated. */
function sanitize_filter_defs(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  raw.forEach((entry) => {
    const field_id = clean(entry && typeof entry === "object" ? entry.field_id : entry);
    if (!field_id || seen.has(field_id) || out.length >= MAX_BOARD_FILTERS) return;
    seen.add(field_id);
    out.push({ field_id });
  });
  return out;
}

/** Errors for filter fields missing from the form or of a type that cannot filter. */
function validate_filter_defs(defs, catalog) {
  const errors = [];
  defs.forEach((def, index) => {
    const field = catalog.fields_by_id.get(def.field_id);
    if (!field) errors.push(`Filter ${index + 1}: unknown field`);
    else if (!FILTER_FIELD_TYPES.includes(field.type)) errors.push(`Filter ${index + 1}: only select, radio, cascading and select group fields can filter`);
  });
  return errors;
}

/** The values a viewer applied: [{ field_id, value }], one per field, blanks dropped. */
function sanitize_applied_filters(raw) {
  if (!Array.isArray(raw)) return [];
  const by_field = new Map();
  raw.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const field_id = clean(entry.field_id);
    if (!field_id || !is_scalar(entry.value) || String(entry.value).trim() === "") return;
    if (by_field.size >= MAX_BOARD_FILTERS && !by_field.has(field_id)) return;
    by_field.set(field_id, { field_id, value: entry.value });
  });
  return Array.from(by_field.values());
}

/**
 * The filters a request really runs under: the link's locked values always
 * win over anything the viewer sent, field by field.
 */
function merge_applied(applied, forced) {
  const by_field = new Map(applied.map((entry) => [entry.field_id, entry]));
  (forced || []).forEach((entry) => by_field.set(entry.field_id, entry));
  return Array.from(by_field.values());
}

/** The first field whose cascade parent is this field (district -> sector). */
function child_field_of(field_id, catalog) {
  for (const field of catalog.fields_by_id.values()) {
    if (field && field.id !== field_id && parent_field_id_of(field, catalog.fields_by_id) === field_id) return field;
  }
  return null;
}

/**
 * The widget as it must be computed under the applied filters, plus the
 * context of every reshaping. Filters on fields the form does not have are
 * ignored. The widget's own filters stay and the board's are added to them.
 */
function apply_board_filters(widget, applied, catalog) {
  const active = applied.filter((entry) => catalog.fields_by_id.has(entry.field_id));
  if (active.length === 0) return { widget, context: [] };
  const value_of = new Map(active.map((entry) => [entry.field_id, entry.value]));
  const adjusted = Object.assign({}, widget);
  const context = [];

  DRILL_ROLES.forEach((role) => {
    const ref = adjusted[role];
    if (!ref || !ref.field_id || !value_of.has(ref.field_id)) return;
    let field_id = ref.field_id;
    // Follow the cascade as deep as the filters go: district -> sector -> cell.
    while (value_of.has(field_id)) {
      const child = child_field_of(field_id, catalog);
      const label = field_label_text(catalog.fields_by_id.get(field_id));
      if (!child) {
        // Nothing below this field: a KPI legend would list one line and
        // goes; a group, split or pattern keeps its one value and still draws.
        context.push({ role, field_id, field_label: label, value: value_of.get(field_id), child_field_id: null, child_label: null });
        adjusted[role] = role === "legend_by" ? null : { field_id };
        return;
      }
      context.push({ role, field_id, field_label: label, value: value_of.get(field_id), child_field_id: child.id, child_label: field_label_text(child) });
      field_id = child.id;
    }
    adjusted[role] = Object.assign({}, ref, { field_id });
  });

  // A split that landed on the group field would say nothing - drop it.
  if (adjusted.split_by && adjusted.group_by && adjusted.split_by.field_id === adjusted.group_by.field_id) adjusted.split_by = null;
  if (adjusted.pattern_by && adjusted.split_by && adjusted.pattern_by.field_id === adjusted.split_by.field_id) adjusted.pattern_by = null;

  // Every other applied value is context too: the card names what it runs under.
  const named = new Set(context.map((entry) => entry.field_id));
  active.forEach((entry) => {
    if (named.has(entry.field_id)) return;
    context.push({ role: "filter", field_id: entry.field_id, field_label: field_label_text(catalog.fields_by_id.get(entry.field_id)), value: entry.value, child_field_id: null, child_label: null });
  });

  const own = Array.isArray(widget.filters) ? widget.filters : [];
  adjusted.filters = own.concat(active.map((entry) => ({ field_id: entry.field_id, operator: "eq", value: entry.value })));
  return { widget: adjusted, context };
}

module.exports = {
  FILTER_FIELD_TYPES,
  MAX_BOARD_FILTERS,
  MAX_FILTER_VALUES,
  sanitize_filter_defs,
  validate_filter_defs,
  sanitize_applied_filters,
  merge_applied,
  child_field_of,
  apply_board_filters,
};
