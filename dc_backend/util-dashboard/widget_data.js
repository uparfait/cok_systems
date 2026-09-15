const pipelines = require("./pipelines.js");
const { kpi_metric_result } = require("./kpi_metrics.js");
const { effective_bounds } = require("./match_stage.js");
const { build_field_catalog, parent_field_id_of, is_categorical } = require("./field_catalog.js");
const { CHART_TYPES, CHART_KINDS, LIMITS } = require("./constants.js");

/**
 * Turns one widget definition into chart-ready data. The database returns
 * already-aggregated rows (see pipelines.js); this module only shapes them:
 * folding small categories into "Other", pivoting split rows into series,
 * zero-filling time buckets, nesting treemap children.
 */

const OTHER_KEY = "__other__";
const MAX_SERIES = 12;
const LEGEND_LIMIT = 12;

function slice_limit(widget) {
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

  const series_totals = new Map();
  raw_rows.forEach((row) => {
    if (!group_set.has(String(row._id.g))) return;
    const split = String(row._id.s);
    series_totals.set(split, (series_totals.get(split) || 0) + (row.value || 0));
  });
  const series = Array.from(series_totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SERIES)
    .map((entry) => entry[0]);
  const series_set = new Set(series);

  const rows = groups.map((group) => ({ label: group }));
  const row_by_group = new Map(rows.map((row) => [row.label, row]));
  raw_rows.forEach((raw) => {
    const group = String(raw._id.g);
    const split = String(raw._id.s);
    if (!group_set.has(group) || !series_set.has(split)) return;
    row_by_group.get(group)[split] = raw.value || 0;
  });
  rows.forEach((row) => series.forEach((key) => { if (row[key] === undefined) row[key] = 0; }));
  return { rows, series };
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

/**
 * The complete data of one widget. The caller has already verified access
 * and resolved the form's active version (for its field catalog).
 */
async function compute_widget_data(widget, form_version, period_override) {
  const catalog = build_field_catalog(form_version.schema);
  const bounds = effective_bounds(widget, period_override);
  let kind = (CHART_TYPES[widget.chart_type] || {}).kind;
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
    const shaped = format_split(widget, raw);
    return { kind, rows: shaped.rows, series: shaped.series };
  }
  const rows = await pipelines.category_rows(widget, bounds, catalog);
  const shaped = format_category(widget, rows);
  return { kind, rows: shaped.rows, series: [], other_folded: shaped.other_folded, other_rows: shaped.other_rows };
}

module.exports = {
  compute_widget_data,
  OTHER_KEY,
};
