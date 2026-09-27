import { parent_filter_of } from "./boardFilters.js";
import { pinned_of } from "./builder/widgetBehavior.js";

/**
 * Going DOWN a cascade from a widget.
 *
 * A form's places come in a chain - district, sector, cell, village - and a
 * widget that shows one level can be asked for the level below it: a chart
 * of districts becomes the same chart of sectors, a card fixed on Gasabo
 * becomes a chart of Gasabo's sectors. Each level down is a new widget
 * derived from the one above, computed like any other, and can go down
 * again until the chain ends.
 *
 * Works on the builder's fields ({ id, label, raw }) and on the public
 * page's plain ones ({ id, label, parent_field_id }) alike.
 */

/** The first field whose cascade parent is this one, or null at the end of the chain. */
export function cascade_child_of(fields, field_id) {
  if (!field_id) return null;
  return (fields || []).find((field) => field && field.id !== field_id && parent_filter_of(field) === field_id) || null;
}

/** The label a field is shown under. */
export const field_label = (field) => (field ? field.label || field.id : "");

/**
 * The values a widget is STACKED on: its own "equals" filters on the board
 * filter fields it ignores - a card that says Gasabo whatever the board's
 * district filter says.
 */
export function stacked_values(widget) {
  const pinned = new Set(pinned_of(widget));
  return ((widget && widget.filters) || [])
    .filter((filter) => filter && filter.operator === "eq" && pinned.has(filter.field_id) && filter.value !== undefined && filter.value !== null && filter.value !== "")
    .map((filter) => ({ field_id: filter.field_id, value: filter.value }));
}

// Looks that group their values along one axis and can be read a level down.
const UNDRILLABLE = ["text", "canvas", "scatter", "bubble", "line", "area"];
// The KPI-only formulas, read the closest groupable way once there is a group.
const GROUPED_EQUIVALENT = { median: "avg", cumulative_sum: "sum", moving_average: "avg", occurrences: "count" };

/**
 * Where a widget can go from here: { from, child, value } - the field it
 * stands on, the field below it, and the one value it is fixed on (null
 * when it shows every value). null when there is nowhere to go: no cascade
 * field, or the chain's last level already.
 */
export function drill_target(widget, fields) {
  if (!widget || UNDRILLABLE.includes(widget.chart_type)) return null;
  if (widget.chart_type === "table" && widget.table && widget.table.mode === "records") return null;
  const group = widget.group_by && !widget.group_by.granularity ? widget.group_by.field_id : null;
  if (group) {
    const child = cascade_child_of(fields, group);
    return child ? { from: group, child, value: null } : null;
  }
  // No group (a KPI card): the one value it is fixed on opens its children.
  const fixed = stacked_values(widget).find((entry) => cascade_child_of(fields, entry.field_id));
  if (fixed) return { from: fixed.field_id, child: cascade_child_of(fields, fixed.field_id), value: fixed.value };
  return null;
}

/**
 * The widget one level down: the same measure, filters, colours and
 * behaviour, grouped by the child field. A grouped widget simply regroups
 * (a split or pattern that would land on the child falls away); a KPI card
 * becomes a bar chart of its value's children. A map has no boundaries
 * for the level below by itself, so it too is drawn as bars.
 */
export function derive_child_widget(widget, target) {
  const child_id = target.child.id;
  const derived = Object.assign({}, widget, {
    id: `${widget.id}__${child_id}`,
    title: `${widget.title || ""}${widget.title ? " - " : ""}${field_label(target.child)}`,
    parent_id: null,
    box: null,
    size: "large",
    position: 0,
    limit: 50,
    group_by: { field_id: child_id },
  });
  if (widget.chart_type === "kpi" || !widget.group_by) {
    const aggregation = (widget.metric && widget.metric.aggregation) || "count";
    derived.chart_type = "bar";
    derived.legend_by = null;
    derived.metric = { aggregation: GROUPED_EQUIVALENT[aggregation] || aggregation, field_id: aggregation === "occurrences" ? null : (widget.metric && widget.metric.field_id) || null };
    derived.display_fields = [];
    derived.same_fields = [];
    derived.occurrence_rule = null;
    derived.over_time = null;
  }
  if (widget.chart_type === "map") derived.chart_type = "bar";
  if (derived.split_by && derived.split_by.field_id === child_id) derived.split_by = null;
  if (derived.pattern_by && derived.pattern_by.field_id === child_id) derived.pattern_by = null;
  return derived;
}

/**
 * The title a card SHOWS. A card stacked on one value (Gasabo) always
 * names it: when the author's title already says so ("Gasabo - households")
 * it is left alone, and when the author renamed the card to something that
 * does not ("Deaths") the value is added in brackets - "Deaths (Gasabo)".
 * The stored title is untouched.
 */
export function shown_title(widget, name_for) {
  const name = (value) => String(name_for ? name_for(value) : value);
  const title = String((widget && widget.title) || "");
  const says = (value) => title.toLowerCase().includes(String(value).toLowerCase());
  const missing = stacked_values(widget)
    .map((entry) => name(entry.value))
    .filter((label, index, list) => !says(label) && list.indexOf(label) === index);
  if (missing.length === 0) return title;
  return title ? `${title} (${missing.join(", ")})` : missing.join(", ");
}
