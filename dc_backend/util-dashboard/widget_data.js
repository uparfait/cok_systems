const pipelines = require("./pipelines.js");
const { kpi_metric_result } = require("./kpi_metrics.js");
const { effective_bounds } = require("./match_stage.js");
const { build_field_catalog, field_label_text, parent_field_id_of, is_categorical } = require("./field_catalog.js");
const { CHART_TYPES, CHART_KINDS, LIMITS, OVER_TIME_TYPES, SUBMITTED_AT_FIELD } = require("./constants.js");

/**
 * Turns one widget definition into chart-ready data. The database returns
 * already-aggregated rows (see pipelines.js); this module only shapes them:
 * folding small categories into "Other", pivoting split rows into series,
 * zero-filling time buckets, nesting treemap children.
 */

const OTHER_KEY = "__other__";
// The one row a widget with nothing to group by draws: its own total.
const TOTAL_KEY = "__total__";
const MAX_SERIES = 12;
const MAX_PATTERNS = 6;
const SERIES_KEY_SEPARATOR = "||";
const LEGEND_LIMIT = 12;

function slice_limit(widget) {
  // A map keeps every place: an "Other" row has no boundary to sit on.
  if (widget.chart_type === "map") return LIMITS.MAX_MAP_CATEGORIES;
  const definition = CHART_TYPES[widget.chart_type] || {};
  const requested = Number(widget.limit) || LIMITS.DEFAULT_CATEGORY_LIMIT;
  const capped = Math.min(Math.max(1, requested), LIMITS.MAX_CATEGORY_LIMIT);
  return definition.max_slices ? Math.min(capped, definition.max_slices) : capped;
}

/**
 * Folding the tail into "Other" only makes sense for additive metrics -
 * averages and extremes are simply truncated to the top rows instead.
 */
function is_additive(widget) {
  const aggregation = (widget.metric && widget.metric.aggregation) || "count";
  return aggregation === "count" || aggregation === "sum";
}

function format_category(widget, rows) {
  const limit = slice_limit(widget);
  const shaped = rows.map((row) => ({ label: String(row._id), value: row.value }));
  if (shaped.length <= limit) return { rows: shaped, other_folded: false, other_rows: [] };
  const kept = shaped.slice(0, limit - (is_additive(widget) ? 1 : 0));
  if (!is_additive(widget)) return { rows: kept, other_folded: false, other_rows: [] };
  // The folded tail rides along so the frontend can show what is inside
  // "Other" when the user asks for it.
  const other_rows = shaped.slice(kept.length);
  const other_total = other_rows.reduce((sum, row) => sum + (row.value || 0), 0);
  return { rows: kept.concat([{ label: OTHER_KEY, value: other_total }]), other_folded: true, other_rows };
}

/**
 * Pivots [{_id: {g, s}, value}] rows into one row per group with one key
 * per split value, the shape grouped/stacked charts and heatmaps consume.
 * Groups are capped by total (descending) at the widget limit, split values
 * at MAX_SERIES.
 */
/** The top values of one id part by total, capped. */
function top_values(raw_rows, part, keep, cap) {
  const totals = new Map();
  raw_rows.forEach((row) => {
    if (!keep(row)) return;
    const value = String(row._id[part]);
    totals.set(value, (totals.get(value) || 0) + (row.value || 0));
  });
  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map((entry) => entry[0]);
}

function format_split(widget, raw_rows) {
  const totals_by_group = new Map();
  raw_rows.forEach((row) => {
    const group = String(row._id.g);
    totals_by_group.set(group, (totals_by_group.get(group) || 0) + (row.value || 0));
  });
  const groups = Array.from(totals_by_group.entries())
    .sort((a, b) => (widget.sort === "label_asc" ? a[0].localeCompare(b[0]) : b[1] - a[1]))
    .slice(0, slice_limit(widget))
    .map((entry) => entry[0]);
  const group_set = new Set(groups);
  const in_groups = (row) => group_set.has(String(row._id.g));

  const splits = top_values(raw_rows, "s", in_groups, MAX_SERIES);
  const split_set = new Set(splits);
  const has_pattern = !!(widget.pattern_by && widget.pattern_by.field_id);
  const patterns = has_pattern ? top_values(raw_rows, "p", (row) => in_groups(row) && split_set.has(String(row._id.s)), MAX_PATTERNS) : [];
  const pattern_set = new Set(patterns);

  // Without a pattern field a series IS a split value; with one, a series
  // is a split/pattern pair keyed "split||pattern" and described in
  // series_meta so the chart can color by split and texture by pattern.
  const series_key = (split, pattern) => (has_pattern ? `${split}${SERIES_KEY_SEPARATOR}${pattern}` : split);
  const series = [];
  const series_meta = [];
  splits.forEach((split) => {
    (has_pattern ? patterns : [null]).forEach((pattern) => {
      series.push(series_key(split, pattern));
      if (has_pattern) series_meta.push({ key: series_key(split, pattern), split, pattern });
    });
  });

  const rows = groups.map((group) => ({ label: group }));
  const row_by_group = new Map(rows.map((row) => [row.label, row]));
  raw_rows.forEach((raw) => {
    const group = String(raw._id.g);
    const split = String(raw._id.s);
    if (!group_set.has(group) || !split_set.has(split)) return;
    if (has_pattern && !pattern_set.has(String(raw._id.p))) return;
    const key = series_key(split, has_pattern ? String(raw._id.p) : null);
    row_by_group.get(group)[key] = (row_by_group.get(group)[key] || 0) + (raw.value || 0);
  });
  rows.forEach((row) => series.forEach((key) => { if (row[key] === undefined) row[key] = 0; }));
  const shaped = { rows, series };
  if (has_pattern) Object.assign(shaped, { series_meta, splits, patterns });
  return shaped;
}

function resolve_granularity(widget, bounds) {
  const requested = widget.group_by && widget.group_by.granularity;
  if (requested && requested !== "auto") return requested;
  const span_days = Math.max(1, Math.ceil((bounds.end - bounds.start) / 86400000));
  if (span_days <= 1) return "hour";
  if (span_days <= 31) return "day";
  if (span_days <= 180) return "week";
  if (span_days <= 730) return "month";
  return "year";
}

function bucket_label(date, granularity) {
  if (granularity === "hour") {
    const hour = date.getHours();
    const suffix = hour >= 12 ? "PM" : "AM";
    return `${hour % 12 || 12}:00 ${suffix}`;
  }
  if (granularity === "day" || granularity === "week") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (granularity === "month") {
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  return String(date.getFullYear());
}

/**
 * Every bucket between the bounds, in order, keyed exactly like the
 * pipeline keys them: fixed windows by index, calendar buckets by string.
 */
function enumerate_buckets(bounds, granularity) {
  const buckets = [];
  const bucket_ms = { hour: 3600000, day: 86400000, week: 604800000 }[granularity];
  if (bucket_ms) {
    const count = Math.min(LIMITS.MAX_TIME_BUCKETS, Math.max(1, Math.ceil((bounds.end - bounds.start + 1) / bucket_ms)));
    for (let index = 0; index < count; index += 1) {
      buckets.push({ key: index, label: bucket_label(new Date(bounds.start.getTime() + index * bucket_ms), granularity) });
    }
    return buckets;
  }
  const cursor = new Date(bounds.start.getFullYear(), granularity === "month" ? bounds.start.getMonth() : 0, 1);
  while (cursor <= bounds.end && buckets.length < LIMITS.MAX_TIME_BUCKETS) {
    const key =
      granularity === "month"
        ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
        : String(cursor.getFullYear());
    buckets.push({ key, label: bucket_label(new Date(cursor), granularity) });
    if (granularity === "month") cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setFullYear(cursor.getFullYear() + 1);
  }
  return buckets;
}

/**
 * The [start, end] of the time bucket a chart labelled `label` - resolved
 * exactly as compute_time bucketed the widget, so a click on a point of a
 * line finds the very records that made it.
 */
async function time_bucket_range(widget, bounds, label) {
  const effective = bounds || (await pipelines.time_extent(widget));
  if (!effective) return null;
  const granularity = resolve_granularity(widget, effective);
  const buckets = enumerate_buckets(effective, granularity);
  const index = buckets.findIndex((bucket) => bucket.label === label);
  if (index < 0) return null;
  const bucket_ms = { hour: 3600000, day: 86400000, week: 604800000 }[granularity];
  if (bucket_ms) {
    const start = new Date(effective.start.getTime() + index * bucket_ms);
    return { start, end: new Date(Math.min(effective.end.getTime(), start.getTime() + bucket_ms - 1)) };
  }
  const [year, month] = String(buckets[index].key).split("-").map(Number);
  const start = granularity === "month" ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
  const next = granularity === "month" ? new Date(year, month, 1) : new Date(year + 1, 0, 1);
  return { start, end: new Date(next.getTime() - 1) };
}

async function compute_time(widget, bounds, catalog) {
  const effective = bounds || (await pipelines.time_extent(widget));
  if (!effective) return { kind: CHART_KINDS.TIME, rows: [], series: [], granularity: "day" };
  const granularity = resolve_granularity(widget, effective);
  const split_field = widget.split_by ? widget.split_by.field_id : null;
  const raw = await pipelines.time_rows(widget, effective, granularity, catalog, split_field);
  const buckets = enumerate_buckets(effective, granularity);

  if (!split_field) {
    const by_key = new Map(raw.map((row) => [String(row._id), row.value || 0]));
    const rows = buckets.map((bucket) => ({ label: bucket.label, value: by_key.get(String(bucket.key)) || 0 }));
    return { kind: CHART_KINDS.TIME, rows, series: [], granularity };
  }

  const series_totals = new Map();
  raw.forEach((row) => {
    const split = String(row._id.s);
    series_totals.set(split, (series_totals.get(split) || 0) + (row.value || 0));
  });
  const series = Array.from(series_totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SERIES)
    .map((entry) => entry[0]);
  const rows = buckets.map((bucket) => {
    const row = { label: bucket.label };
    series.forEach((key) => { row[key] = 0; });
    return row;
  });
  const row_by_key = new Map(buckets.map((bucket, index) => [String(bucket.key), rows[index]]));
  raw.forEach((entry) => {
    const row = row_by_key.get(String(entry._id.b));
    const split = String(entry._id.s);
    if (row && series.includes(split)) row[split] = entry.value || 0;
  });
  return { kind: CHART_KINDS.TIME, rows, series, granularity };
}

function nest_tree(raw_rows, has_parent) {
  if (!has_parent) {
    return raw_rows.map((row) => ({ name: String(row._id.c), value: row.value || 0 }));
  }
  const parents = new Map();
  raw_rows.forEach((row) => {
    const parent = String(row._id.p === null || row._id.p === undefined ? "" : row._id.p) || "-";
    if (!parents.has(parent)) parents.set(parent, []);
    parents.get(parent).push({ name: String(row._id.c), value: row.value || 0 });
  });
  return Array.from(parents.entries()).map(([name, children]) => ({
    name,
    value: children.reduce((sum, child) => sum + child.value, 0),
    children,
  }));
}

/** One stored answer as the text it is shown as in an occurrence label. */
function answer_text(value) {
  if (value === undefined || value === null || value === "") return "";
  if (Array.isArray(value)) return value.map(answer_text).filter(Boolean).join(", ");
  if (typeof value === "object") {
    // A location answer reads as its address, an uploaded file as its name.
    if (value.full_address) return String(value.full_address);
    if (value.name) return String(value.name);
    if (value.url) return String(value.url);
    return "";
  }
  return String(value);
}

/**
 * "Count occurrences": how many times each value of a field occurs, each
 * value labelled by its display fields joined with " - " (or by the value
 * itself). A KPI card shows how many DIFFERENT values met the rule (every
 * value, without one) and lists them under the number; a chart draws one
 * mark per value; a treemap one tile per value. Rows carry a matches flag
 * so a card showing every value can still point out the ones that met
 * the rule.
 */
async function compute_occurrences(widget, kind, bounds, catalog) {
  const raw = await pipelines.occurrence_rows(widget, bounds, catalog);
  const display_fields = Array.isArray(widget.display_fields) ? widget.display_fields : [];
  const separator = typeof widget.display_separator === "string" && widget.display_separator !== "" ? widget.display_separator : " - ";
  const rows = raw.map((row) => {
    // The label: the display answers, then whatever "same" values this
    // group shares (a status, a gender), so two groups of one id read apart.
    const parts = display_fields.map((field_id) => answer_text(row.display[field_id])).filter(Boolean);
    const shared = Object.keys(row.shared || {}).map((field_id) => answer_text(row.shared[field_id])).filter(Boolean);
    const head = parts.length > 0 ? parts.join(separator) : answer_text(row._id) || "-";
    return { label: [head].concat(shared).join(separator), value: row.value || 0, matches: row.matches, record_key: row._id, shared: row.shared || {} };
  });
  const has_rule = !!(widget.occurrence_rule && widget.occurrence_rule.operator);
  const matching = rows.filter((row) => row.matches);
  const occurrences = {
    values: rows.length,
    matching: has_rule ? matching.length : rows.length,
    total: rows.reduce((sum, row) => sum + row.value, 0),
    has_rule,
    scope: widget.occurrence_scope === "all" ? "all" : "matching",
  };
  if (kind === CHART_KINDS.KPI) {
    return { kind, value: occurrences.matching, previous: null, change_pct: null, skipped: 0, occurrences, legend: rows.slice(0, LEGEND_LIMIT) };
  }
  const limit = slice_limit(widget);
  if (kind === CHART_KINDS.TREE) {
    return { kind, occurrences, nodes: rows.slice(0, limit).map((row) => ({ name: row.label, value: row.value, matches: row.matches, record_key: row.record_key, shared: row.shared })) };
  }
  return { kind: CHART_KINDS.CATEGORY, occurrences, rows: rows.slice(0, limit), series: [], other_folded: false, other_rows: [] };
}

/**
 * The "total X" line a chart carries under its legend: for every choice
 * field the widget reads - what it groups by, splits by, patterns by, the
 * values a KPI legends by, the field an occurrence widget counts - how
 * many different values that field holds under the widget's own filters,
 * the board's filters and the window. Everything the viewer filters is
 * therefore reflected in the numbers.
 */
async function dimension_totals(widget, bounds, catalog) {
  const shaped = ungrouped_widget(widget);
  const ids = [];
  const add = (field_id) => {
    if (field_id && catalog.fields_by_id.has(field_id) && is_categorical(catalog, field_id) && !ids.includes(field_id)) ids.push(field_id);
  };
  if (((widget.metric && widget.metric.aggregation) || "count") === "occurrences") add(widget.metric && widget.metric.field_id);
  [shaped.group_by, shaped.split_by, shaped.pattern_by, shaped.legend_by].forEach((ref) => ref && add(ref.field_id));
  const counts = await pipelines.dimension_counts(shaped, bounds, catalog, ids);
  return counts.map((entry) => ({ field_id: entry.field_id, label: field_label_text(catalog.fields_by_id.get(entry.field_id)), count: entry.count }));
}

/**
 * Group by is optional. With no group field a widget draws its SPLIT
 * field instead - one mark per split value - and with neither it is the
 * single total of everything it selects. Shaping it in one place keeps
 * the charts, the records behind them and the export reading the same
 * widget.
 */
function ungrouped_widget(widget) {
  if (!widget || (widget.group_by && widget.group_by.field_id)) return widget;
  if (widget.split_by && widget.split_by.field_id) return Object.assign({}, widget, { group_by: { field_id: widget.split_by.field_id }, split_by: null, pattern_by: null });
  return widget;
}

/**
 * A heat map's data: the points themselves, what the split field divides
 * them into (with what each value weighs, for the legend) and the lightest
 * and heaviest point there is, which is what a heat scale is read against.
 */
async function heat_data(widget, bounds) {
  const points = await pipelines.heat_points(widget, bounds);
  const totals = new Map();
  let low = null;
  let high = null;
  points.forEach((point) => {
    const weight = Number(point.weight) || 0;
    if (low === null || weight < low) low = weight;
    if (high === null || weight > high) high = weight;
    const name = point.group === null || point.group === undefined ? "" : String(point.group);
    if (name) totals.set(name, (totals.get(name) || 0) + weight);
  });
  const groups = Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, LEGEND_LIMIT);
  return {
    kind: CHART_KINDS.HEAT,
    points,
    groups,
    range: { low: low === null ? 0 : low, high: high === null ? 0 : high },
    weighted: !!(widget.map && widget.map.weight_field_id),
    capped: points.length >= LIMITS.MAX_HEAT_POINTS,
  };
}

/**
 * The complete data of one widget. The caller has already verified access
 * and resolved the form's active version (for its field catalog).
 */
async function widget_data_of(raw_widget, form_version, period_override) {
  const catalog = build_field_catalog(form_version.schema);
  const bounds = effective_bounds(raw_widget, period_override);
  let kind = (CHART_TYPES[raw_widget.chart_type] || {}).kind;
  // A canvas is a place, not a question: there is nothing to compute.
  if (kind === CHART_KINDS.CANVAS) return { kind: CHART_KINDS.CANVAS };
  // A heat map is not a category chart at all: it is the records
  // themselves, each at the place it was collected, so it never goes near
  // grouping, folding or a limit.
  if (raw_widget.chart_type === "map" && raw_widget.map && raw_widget.map.mode === "heat") {
    return heat_data(raw_widget, bounds);
  }
  if (((raw_widget.metric && raw_widget.metric.aggregation) || "count") === "occurrences") {
    return compute_occurrences(raw_widget, kind, bounds, catalog);
  }
  // OVER TIME: the same widget, the same formula, read as the period
  // passes instead of all at once. Whatever it groups by otherwise is set
  // aside - the time line is the axis now - while a split_by still draws
  // one series per value, so "average age over time, by gender" works. The
  // slice size comes from the period itself unless one was asked for (see
  // resolve_granularity): a day reads in hours, a month in days, a decade
  // in years, and a custom range in whatever suits its own length.
  const over_time = raw_widget.over_time && raw_widget.over_time.enabled === true ? raw_widget.over_time : null;
  if (over_time && OVER_TIME_TYPES.includes(raw_widget.chart_type)) {
    const timed = Object.assign({}, raw_widget, {
      group_by: { field_id: over_time.field_id || SUBMITTED_AT_FIELD, granularity: over_time.granularity || "auto" },
    });
    return compute_time(timed, bounds, catalog);
  }
  const widget = kind === CHART_KINDS.KPI || kind === CHART_KINDS.POINT ? raw_widget : ungrouped_widget(raw_widget);
  // Nothing to group by and nothing to split by: the widget is one number,
  // drawn as the single mark of a one-row chart.
  if (!(widget.group_by && widget.group_by.field_id) && kind !== CHART_KINDS.KPI && kind !== CHART_KINDS.POINT) {
    const total = await kpi_metric_result(widget, bounds, catalog);
    const rows = [{ label: TOTAL_KEY, value: total.current || 0 }];
    if (kind === CHART_KINDS.TREE) return { kind, nodes: [{ name: TOTAL_KEY, value: total.current || 0 }] };
    return { kind: CHART_KINDS.CATEGORY, rows, series: [], other_folded: false, other_rows: [] };
  }
  // A line/area chart grouped by a CHOICE field charts categories, not
  // time - any category chart can be flipped into a line/area look and
  // back, so its data comes from the category pipelines.
  if (kind === CHART_KINDS.TIME && widget.group_by && is_categorical(catalog, widget.group_by.field_id)) {
    kind = CHART_KINDS.CATEGORY;
  }

  if (kind === CHART_KINDS.KPI) {
    const result = await kpi_metric_result(widget, bounds, catalog);
    const change_pct =
      result.previous === null || result.previous === 0
        ? null
        : Math.round(((result.current - result.previous) / Math.abs(result.previous)) * 1000) / 10;
    // skipped: answers inside the window the numeric formula could not read
    // as numbers - the card flags them and can list them in full.
    const data = { kind, value: result.current || 0, previous: result.previous, change_pct, skipped: result.skipped || 0 };
    // The legend: the same measure, grouped by the legend field over the
    // very same records (filters and window included) - "count of status
    // in Nyagatare" lists live / sold / dead under the total.
    if (widget.legend_by && widget.legend_by.field_id) {
      const legend_rows = await pipelines.category_rows(
        Object.assign({}, widget, { group_by: { field_id: widget.legend_by.field_id }, sort: "value_desc" }),
        bounds,
        catalog,
      );
      data.legend = legend_rows.slice(0, LEGEND_LIMIT).map((row) => ({ label: String(row._id), value: row.value }));
    }
    return data;
  }
  if (kind === CHART_KINDS.POINT) {
    const points = await pipelines.point_rows(widget, bounds);
    return { kind, points };
  }
  if (kind === CHART_KINDS.TREE) {
    const parent_id = parent_field_id_of(catalog.fields_by_id.get(widget.group_by.field_id), catalog.fields_by_id);
    const raw = await pipelines.tree_rows(widget, bounds, catalog, parent_id);
    return { kind, nodes: nest_tree(raw, !!parent_id) };
  }
  if (kind === CHART_KINDS.TIME) {
    return compute_time(widget, bounds, catalog);
  }
  if (widget.split_by && widget.split_by.field_id) {
    const raw = await pipelines.split_rows(widget, bounds, catalog);
    return Object.assign({ kind }, format_split(widget, raw));
  }
  const rows = await pipelines.category_rows(widget, bounds, catalog);
  const shaped = format_category(widget, rows);
  return { kind, rows: shaped.rows, series: [], other_folded: shaped.other_folded, other_rows: shaped.other_rows };
}

/**
 * The complete data of one widget, plus the totals line under its legend.
 */
async function compute_widget_data(widget, form_version, period_override) {
  const data = await widget_data_of(widget, form_version, period_override);
  // A KPI card is one number with its own legend: no count line under it.
  if (data.kind === CHART_KINDS.KPI) return data;
  const catalog = build_field_catalog(form_version.schema);
  data.totals = await dimension_totals(widget, effective_bounds(widget, period_override), catalog);
  return data;
}

module.exports = {
  compute_widget_data,
  ungrouped_widget,
  time_bucket_range,
  OTHER_KEY,
  TOTAL_KEY,
};
