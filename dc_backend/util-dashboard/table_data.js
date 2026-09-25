const { get_db } = require("../db_connection/db.js");
const { base_stages, filter_stages, numeric_expr } = require("./match_stage.js");
const { is_multi_value, field_label_text } = require("./field_catalog.js");
const { time_field } = require("../utilities/tracking_window.js");
const { CHART_KINDS, TABLE_LIMITS, SUBMITTED_AT_FIELD, NUMERIC_AGGREGATIONS } = require("./constants.js");

const SUBMISSIONS_COLLECTION = "dcs_submissions";
// Formulas whose total is the sum of the parts: a total row or column can
// be added up from the cells on show, and surplus columns folded into one.
// Anything else (an average, an extreme) has to be computed again over the
// same records, and cannot be folded.
const ADDITIVE = ["count", "sum"];
// The column the split values beyond the cap are folded into.
const OTHER_KEY = "__other__";

/**
 * The data of a TABLE widget, both kinds.
 *
 * RECORDS: the submissions behind the widget - under its own filters, the
 * board's filters and the window, exactly like every other widget - a page
 * at a time, the chosen fields as columns. The page wanted rides on
 * table.page of the request; nothing about paging is ever stored. A page
 * past the end (the viewer was on page 3, then a filter left two rows)
 * comes back as the last page there is.
 *
 * SUMMARY: one row per value of the group field - the most frequent ones
 * under the widget's selection, capped by widget.limit, so a field with
 * thousands of values never fans out into thousands of rows. The columns
 * are the values of the split field (each cell the widget's own formula
 * over the records of that row and that column; values past the column
 * cap are folded into Other when the formula adds up), or the MEASURES the
 * author defined - each its own formula on its own field, under its own
 * filters, so one table can put deaths, injured and damaged houses side by
 * side per district. The total row and the total column are worked out
 * from the cells on show when the formula adds up (count, sum), and
 * computed again over the very same records when it does not.
 */

const run = (pipeline) => get_db().collection(SUBMISSIONS_COLLECTION).aggregate(pipeline, { allowDiskUse: true }).toArray();

const round = (value) => (Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) / 100 : 0);

/** The column description the card labels from, in the reader's language. */
function describe_field(catalog, field_id) {
  const field = catalog.fields_by_id.get(field_id);
  return { id: field_id, type: field ? field.type : "text", label: field && field.label && typeof field.label === "object" ? field.label : { en: field_label_text(field) || field_id } };
}

const page_size_of = (settings) => Math.min(TABLE_LIMITS.MAX_PAGE_SIZE, Math.max(TABLE_LIMITS.MIN_PAGE_SIZE, Number(settings.page_size) || TABLE_LIMITS.DEFAULT_PAGE_SIZE));

/**
 * records_policy is what a PUBLIC share link allows its viewers to see of
 * the records themselves: { allowed, fields }. A link that does not allow
 * records gets a locked, empty table (the card says so); one that allows
 * only some fields gets the table cut down to those. Signed-in viewers
 * pass no policy and see everything.
 */
async function table_records(widget, bounds, catalog, records_policy) {
  const settings = widget.table || {};
  const page_size = page_size_of(settings);
  if (records_policy && records_policy.allowed === false) {
    return { kind: CHART_KINDS.TABLE, mode: "records", locked: true, columns: [], items: [], total: 0, page: 1, page_size, pages: 1, show_submitted_at: settings.show_submitted_at !== false };
  }
  const allowed = records_policy && Array.isArray(records_policy.fields) && records_policy.fields.length > 0 ? new Set(records_policy.fields) : null;
  const fields = (settings.fields || []).filter((field_id) => catalog.fields_by_id.has(field_id) && (!allowed || allowed.has(field_id)));
  const sort = settings.sort || {};
  const direction = sort.direction === "asc" ? 1 : -1;
  // On a tracked form a row is a STAGE, so the clock the rows are sorted
  // by is the moment each stage opened, as on every other widget.
  const clock = time_field(widget.tracking);
  const order = sort.field_id && sort.field_id !== SUBMITTED_AT_FIELD && catalog.fields_by_id.has(sort.field_id) ? { [`data.${sort.field_id}`]: direction, _id: -1 } : { [clock]: direction, _id: -1 };
  const projection = { _id: 1, submitted_at: 1 };
  if (clock !== SUBMITTED_AT_FIELD) projection[clock] = 1;
  fields.forEach((field_id) => {
    projection[`data.${field_id}`] = 1;
  });
  const opening = base_stages(widget, bounds);
  const read_page = async (page) => {
    const [result] = await run([...opening, { $facet: { items: [{ $sort: order }, { $skip: (page - 1) * page_size }, { $limit: page_size }, { $project: projection }], total: [{ $count: "count" }] } }]);
    return { items: (result && result.items) || [], total: result && result.total && result.total[0] ? result.total[0].count : 0 };
  };
  let page = Math.max(1, Math.round(Number(settings.page) || 1));
  let read = await read_page(page);
  let pages = Math.max(1, Math.ceil(read.total / page_size));
  // Asked for a page that no longer exists: the last one is what is meant.
  if (read.items.length === 0 && page > pages) {
    page = pages;
    read = await read_page(page);
    pages = Math.max(1, Math.ceil(read.total / page_size));
  }
  const items = read.items.map((item) => ({
    _id: item._id,
    // The moment this row stands for: when it was submitted, or on a
    // tracked form when its stage opened.
    submitted_at: clock !== SUBMITTED_AT_FIELD && item[clock] ? item[clock] : item.submitted_at,
    data: item.data || {},
  }));
  return {
    kind: CHART_KINDS.TABLE,
    mode: "records",
    columns: fields.map((field_id) => describe_field(catalog, field_id)),
    items,
    total: read.total,
    page,
    page_size,
    pages,
    show_submitted_at: settings.show_submitted_at !== false,
  };
}

/** The accumulator of one formula, and the stage that finishes it. */
function accumulate(aggregation, field_id) {
  if (aggregation === "count") return { group: { $sum: 1 }, post: [] };
  if (aggregation === "count_distinct") return { group: { $addToSet: `$data.${field_id}` }, post: [{ $set: { value: { $size: { $ifNull: ["$value", []] } } } }] };
  const operator = { sum: "$sum", avg: "$avg", min: "$min", max: "$max", stddev: "$stdDevPop" }[aggregation] || "$sum";
  return { group: { [operator]: numeric_expr(field_id) }, post: [] };
}

/** The stages narrowing to the records one formula reads: its filters, and the answered field when it needs one. */
function formula_scope(aggregation, field_id, filters, catalog) {
  const stages = filter_stages({ filters: filters || [] });
  if (field_id && catalog.fields_by_id.has(field_id) && (NUMERIC_AGGREGATIONS.includes(aggregation) || aggregation === "count_distinct" || aggregation === "count")) {
    stages.push({ $match: { [`data.${field_id}`]: { $nin: [null, ""] } } });
    if (is_multi_value(catalog, field_id) && aggregation === "count_distinct") stages.push({ $unwind: { path: `$data.${field_id}`, preserveNullAndEmptyArrays: false } });
  }
  return stages;
}

const unwind_if_multi = (catalog, field_id) => (is_multi_value(catalog, field_id) ? [{ $unwind: { path: `$data.${field_id}`, preserveNullAndEmptyArrays: false } }] : []);

/** The stages every summary pipeline opens with: the selection, one row per group value, the group answered. */
function opening_stages(widget, bounds, catalog, group_id) {
  return [...base_stages(widget, bounds), ...unwind_if_multi(catalog, group_id), { $match: { [`data.${group_id}`]: { $nin: [null, ""] } } }];
}

/** The group values on show: the most frequent under the widget's selection, capped. */
async function shown_groups(opening, group_id, limit) {
  const rows = await run([...opening, { $group: { _id: `$data.${group_id}`, n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }, { $limit: limit }]);
  return rows.map((row) => row._id);
}

/** The measure columns as the author defined them, or the widget's own formula as the one column of a split table without a split. */
function measure_columns(widget) {
  const columns = (widget.table && widget.table.columns) || [];
  if (columns.length > 0) {
    return columns.map((column, index) => ({ key: column.key || `c${index + 1}`, label: column.label || "", aggregation: column.aggregation || "count", field_id: column.field_id || null, filters: column.filters || [] }));
  }
  // A split table whose split fell away (a board drill landed the group
  // on it) still has its formula: one column of it, so the table degrades
  // to a one-column breakdown rather than to nothing.
  const metric = widget.metric || { aggregation: "count", field_id: null };
  return [{ key: "value", label: "", aggregation: metric.aggregation || "count", field_id: metric.field_id || null, filters: [] }];
}

/** Every measure cell in one round trip: a facet per column, each grouped by the group value, over the shown groups only. */
async function measure_cells(opening, group_id, shown, columns, catalog) {
  const facets = {};
  columns.forEach((column, index) => {
    const accumulator = accumulate(column.aggregation, column.field_id);
    facets[`c${index}`] = [...formula_scope(column.aggregation, column.field_id, column.filters, catalog), { $group: { _id: `$data.${group_id}`, value: accumulator.group } }, ...accumulator.post, { $match: { value: { $ne: null } } }];
  });
  const [facet] = await run([...opening, { $match: { [`data.${group_id}`]: { $in: shown } } }, { $facet: facets }]);
  const cells = new Map();
  columns.forEach((column, index) => {
    ((facet && facet[`c${index}`]) || []).forEach((entry) => {
      const label = String(entry._id);
      if (!cells.has(label)) cells.set(label, {});
      cells.get(label)[column.key] = round(entry.value);
    });
  });
  return cells;
}

/** The measure totals over the shown rows, computed again - for formulas that do not add up. */
async function measure_totals(opening, group_id, shown, columns, catalog) {
  const facets = {};
  columns.forEach((column, index) => {
    const accumulator = accumulate(column.aggregation, column.field_id);
    facets[`c${index}`] = [...formula_scope(column.aggregation, column.field_id, column.filters, catalog), { $group: { _id: null, value: accumulator.group } }, ...accumulator.post];
  });
  const [facet] = await run([...opening, { $match: { [`data.${group_id}`]: { $in: shown } } }, { $facet: facets }]);
  const cells = {};
  columns.forEach((column, index) => {
    const bucket = facet && facet[`c${index}`] && facet[`c${index}`][0];
    cells[column.key] = round(bucket ? bucket.value : 0);
  });
  return cells;
}

/**
 * A SPLIT table's cells: the formula grouped by group value AND split
 * value in one pass. The columns are the split values with the largest
 * totals; past the cap the rest are folded into Other when the formula
 * adds up, and simply left out when it does not (the table says so).
 */
async function split_cells(opening, group_id, split_id, shown, metric, catalog) {
  const aggregation = metric.aggregation || "count";
  const accumulator = accumulate(aggregation, metric.field_id);
  const raw = await run([
    ...opening,
    { $match: { [`data.${group_id}`]: { $in: shown } } },
    ...formula_scope(aggregation, metric.field_id, [], catalog),
    ...unwind_if_multi(catalog, split_id),
    { $match: { [`data.${split_id}`]: { $nin: [null, ""] } } },
    { $group: { _id: { g: `$data.${group_id}`, s: `$data.${split_id}` }, value: accumulator.group } },
    ...accumulator.post,
    { $match: { value: { $ne: null } } },
  ]);
  const additive = ADDITIVE.includes(aggregation);
  const totals = new Map();
  raw.forEach((entry) => {
    const split = String(entry._id.s);
    totals.set(split, (totals.get(split) || 0) + (entry.value || 0));
  });
  const ordered = Array.from(totals.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const kept = ordered.slice(0, TABLE_LIMITS.MAX_COLUMNS).map((entry) => entry[0]);
  const folded = new Set(ordered.slice(TABLE_LIMITS.MAX_COLUMNS).map((entry) => entry[0]));
  const columns = kept.map((split) => ({ key: split, label: split, aggregation, field_id: metric.field_id || null, filters: [], split_value: split }));
  if (folded.size > 0 && additive) columns.push({ key: OTHER_KEY, label: OTHER_KEY, aggregation, field_id: metric.field_id || null, filters: [], folded: folded.size });
  const cells = new Map();
  raw.forEach((entry) => {
    const label = String(entry._id.g);
    const split = String(entry._id.s);
    const key = folded.has(split) ? (additive ? OTHER_KEY : null) : split;
    if (!key) return;
    if (!cells.has(label)) cells.set(label, {});
    cells.get(label)[key] = round((cells.get(label)[key] || 0) + (entry.value || 0));
  });
  return { columns, cells, capped: folded.size > 0 && !additive };
}

/** The split totals over the shown rows, computed again - for formulas that do not add up. */
async function split_totals(opening, group_id, split_id, shown, columns, metric, catalog) {
  const aggregation = metric.aggregation || "count";
  const facets = {};
  columns.forEach((column, index) => {
    const accumulator = accumulate(aggregation, metric.field_id);
    facets[`c${index}`] = [...unwind_if_multi(catalog, split_id), { $match: { [`data.${split_id}`]: { $in: [column.split_value] } } }, ...formula_scope(aggregation, metric.field_id, [], catalog), { $group: { _id: null, value: accumulator.group } }, ...accumulator.post];
  });
  const [facet] = await run([...opening, { $match: { [`data.${group_id}`]: { $in: shown } } }, { $facet: facets }]);
  const cells = {};
  columns.forEach((column, index) => {
    const bucket = facet && facet[`c${index}`] && facet[`c${index}`][0];
    cells[column.key] = round(bucket ? bucket.value : 0);
  });
  return cells;
}

async function table_summary(widget, bounds, catalog) {
  const group_id = widget.group_by.field_id;
  const split_id = widget.split_by && widget.split_by.field_id;
  const settings = widget.table || {};
  const totals = settings.totals || { row: true, column: false };
  const opening = opening_stages(widget, bounds, catalog, group_id);
  const limit = Math.min(TABLE_LIMITS.MAX_SUMMARY_ROWS, Math.max(1, Number(widget.limit) || 12));
  const shown = await shown_groups(opening, group_id, limit);
  const empty = { kind: CHART_KINDS.TABLE, mode: "summary", group_field: describe_field(catalog, group_id), columns: [], rows: [], table_totals: null };
  if (shown.length === 0) return empty;

  let columns;
  let cells;
  let capped = false;
  const metric = widget.metric || { aggregation: "count", field_id: null };
  if (split_id) {
    const split = await split_cells(opening, group_id, split_id, shown, metric, catalog);
    columns = split.columns;
    cells = split.cells;
    capped = split.capped;
  } else {
    columns = measure_columns(widget);
    cells = await measure_cells(opening, group_id, shown, columns, catalog);
  }
  if (columns.length === 0) return empty;
  const additive = columns.every((column) => ADDITIVE.includes(column.aggregation));
  const row_total = (row_cells) => columns.reduce((sum, column) => sum + (row_cells[column.key] || 0), 0);
  const rows = shown
    .map((value) => {
      const row_cells = Object.assign({}, cells.get(String(value)) || {});
      columns.forEach((column) => {
        if (row_cells[column.key] === undefined) row_cells[column.key] = 0;
      });
      // A total column only adds up when the columns add up.
      return { label: String(value), cells: row_cells, total: totals.column && additive ? round(row_total(row_cells)) : null };
    })
    .sort((a, b) => (widget.sort === "label_asc" ? a.label.localeCompare(b.label) : widget.sort === "value_asc" ? row_total(a.cells) - row_total(b.cells) : row_total(b.cells) - row_total(a.cells)));

  let total_row = null;
  if (totals.row) {
    let total_cells;
    if (additive) {
      total_cells = {};
      columns.forEach((column) => {
        total_cells[column.key] = round(rows.reduce((sum, row) => sum + (row.cells[column.key] || 0), 0));
      });
    } else if (split_id) {
      total_cells = await split_totals(opening, group_id, split_id, shown, columns, metric, catalog);
    } else {
      total_cells = await measure_totals(opening, group_id, shown, columns, catalog);
    }
    total_row = { cells: total_cells, total: totals.column && additive ? round(columns.reduce((sum, column) => sum + (total_cells[column.key] || 0), 0)) : null };
  }
  return {
    kind: CHART_KINDS.TABLE,
    mode: "summary",
    group_field: describe_field(catalog, group_id),
    columns: columns.map((column) => ({ key: column.key, label: column.label, aggregation: column.aggregation, field_id: column.field_id, split_value: column.split_value, folded: column.folded })),
    rows,
    // Named apart from the dimension totals every widget carries under
    // its legend, which compute_widget_data writes to `totals`.
    table_totals: { row: total_row, column: !!(totals.column && additive), additive, capped },
  };
}

/** The data of one table widget, whichever kind it is. */
function table_data(widget, bounds, catalog, records_policy) {
  const mode = widget.table && widget.table.mode;
  return mode === "summary" ? table_summary(widget, bounds, catalog) : table_records(widget, bounds, catalog, records_policy);
}

module.exports = { table_data, table_records, table_summary, OTHER_KEY };
