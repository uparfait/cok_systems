import { parent_filter_of } from "./boardFilters.js";
import { pinned_of } from "./builder/widgetBehavior.js";
import { level_of, MAP_LEVELS } from "./builder/mapFields.js";
import { type_rules, PATTERN_CHART_TYPES, SINGLE_OF } from "./builder/typeRules.js";
import { OVER_TIME_TYPES } from "./overTime.js";

/**
 * Going DOWN a cascade from a widget.
 *
 * A form's places come in a chain - district, sector, cell, village - and a
 * widget that shows one level can be asked for the level below it: a chart
 * of districts becomes the same chart of sectors, a card fixed on Gasabo
 * becomes a chart of Gasabo's sectors, a map of districts becomes a map of
 * one district's sectors. Each level down is a new widget derived from the
 * one above, computed like any other, and can go down again until the
 * chain ends.
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

// Widgets with nothing to drill: words, a section, and the point charts,
// which spend their axes on numbers rather than on a field of values.
const UNDRILLABLE = ["text", "canvas", "scatter", "bubble"];
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

const is_set = (value) => value !== undefined && value !== null && value !== "";

/**
 * A widget cut down to what its own chart type can carry, by the rules the
 * server validates against (dc_backend/util-dashboard/widget_validation.js):
 * a split only where the type takes one - and a type that NEEDS one falls
 * back to its single-series look when none is left; a pattern only on the
 * grouped and stacked bars; a legend only on a KPI card; a time line only
 * on the looks that have an axis for it; a summary table with neither a
 * split nor a measure column becomes bars; and a formula only a card can
 * read is replaced by its grouped equivalent.
 */
export function fit_to_type(widget) {
  const out = Object.assign({}, widget);
  const rules = type_rules(out.chart_type);
  const group_id = out.group_by && out.group_by.field_id;
  const split_id = out.split_by && out.split_by.field_id;
  if (rules.split === "none" || !split_id || split_id === group_id) out.split_by = null;
  if (rules.split === "required" && !out.split_by) out.chart_type = SINGLE_OF[out.chart_type] || "bar";
  const kept_split = out.split_by && out.split_by.field_id;
  const pattern_id = out.pattern_by && out.pattern_by.field_id;
  if (!pattern_id || !PATTERN_CHART_TYPES.includes(out.chart_type) || pattern_id === group_id || pattern_id === kept_split) out.pattern_by = null;
  if (out.chart_type !== "kpi") out.legend_by = null;
  if (!OVER_TIME_TYPES.includes(out.chart_type) || !(out.over_time && out.over_time.enabled === true)) out.over_time = null;
  if (out.chart_type === "table") {
    const settings = out.table || {};
    const columns = Array.isArray(settings.columns) ? settings.columns : [];
    if (settings.mode === "summary" && !out.split_by && columns.length === 0) {
      out.chart_type = "bar";
      out.table = null;
    }
  }
  const aggregation = (out.metric && out.metric.aggregation) || "count";
  if (out.chart_type !== "kpi" && GROUPED_EQUIVALENT[aggregation]) {
    out.metric = { aggregation: GROUPED_EQUIVALENT[aggregation], field_id: aggregation === "occurrences" ? null : (out.metric && out.metric.field_id) || null };
    out.display_fields = [];
    out.same_fields = [];
    out.occurrence_rule = null;
  }
  return out;
}

/**
 * The widget one level down: the same measure, filters, colours and
 * behaviour, grouped by the child field, then cut down to what its type
 * can carry (see fit_to_type). A KPI card becomes a bar chart of its
 * value's children. A map stays a map when the child field names a level
 * the map can draw - the clicked parent value becomes a filter the widget
 * is pinned on, so the map is scoped to that one place and its children's
 * boundaries are drawn - and is drawn as bars only when the child names
 * no place.
 */
export function derive_child_widget(widget, target, value) {
  const child_id = target.child.id;
  const picked = is_set(value) ? value : target.value;
  const fixed = is_set(picked);
  const derived = Object.assign({}, widget, {
    id: `${widget.id}__${child_id}${fixed ? `__${String(picked)}` : ""}`,
    title: `${widget.title || ""}${widget.title ? " - " : ""}${field_label(target.child)}`,
    parent_id: null,
    box: null,
    size: "large",
    position: 0,
    limit: 50,
    group_by: { field_id: child_id },
  });
  if (widget.chart_type === "kpi" || !widget.group_by) derived.chart_type = "bar";
  if (widget.chart_type === "map") {
    const level = level_of(target.child);
    if (level && MAP_LEVELS.includes(level)) derived.map = Object.assign({}, widget.map || {}, { mode: "world", level });
    else derived.chart_type = "bar";
  }
  if (fixed) {
    const others = (widget.filters || []).filter((filter) => !(filter && filter.field_id === target.from && filter.operator === "eq"));
    derived.filters = others.concat([{ field_id: target.from, operator: "eq", value: picked }]);
    const pinned = pinned_of(widget);
    derived.pinned_fields = pinned.includes(target.from) ? pinned : pinned.concat([target.from]);
  }
  return fit_to_type(derived);
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
