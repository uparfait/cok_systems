const { get_db } = require("../db_connection/db.js");
const forms_model = require("../models/forms_model.js");
const { flatten_fields } = require("../jsonlogic/dependency_graph.js");
const { sanitize_widget, sanitize_period_override } = require("./sanitize.js");
const { validate_dashboard } = require("./widget_validation.js");
const { base_stages, effective_bounds, value_candidates, numeric_expr } = require("./match_stage.js");
const { build_field_catalog, field_label_text, parent_field_id_of } = require("./field_catalog.js");
const { sanitize_applied_filters, merge_applied, apply_board_filters } = require("./board_filters.js");
const { time_bucket_range, ungrouped_widget } = require("./widget_data.js");
const pipelines = require("./pipelines.js");
const { SUBMITTED_AT_FIELD } = require("./constants.js");

const COLLECTION = "dcs_submissions";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_EXPORT_ROWS = 20000;
const MAX_OCCURRENCE_KEYS = 5000;
const NON_DATA_TYPES = ["section", "paragraph", "header", "file", "group", "image_block", "horizontal_line"];

/**
 * The records behind a widget: the submissions its number or chart was
 * computed from - under the widget's own filters, the board's applied
 * filters and the period - narrowed further by what the viewer clicked:
 * a bar or slice = one category value, a segment or legend entry = one
 * split value, a point of a line = one time bucket, a scatter point = its
 * two numbers, a treemap tile = its value (or its parent's), and on a
 * "count occurrences" widget one counted value with whatever "same" values
 * it shares. A whole occurrence widget with a rule opens only the records
 * of the values that met the rule - exactly what the widget counted.
 * Paged, newest first, with the fields' columns and the criteria the rows
 * match so the table can highlight them; or exported whole to Excel.
 */

const clean = (value) => (typeof value === "string" ? value.trim() : value);
const eq = (field_id, value) => ({ [`data.${field_id}`]: { $in: value_candidates(value) } });
const is_occurrences = (widget) => ((widget.metric && widget.metric.aggregation) || "count") === "occurrences";

/**
 * The extra conditions of one click, plus the criteria they add. Async
 * because a time bucket is resolved from the widget's own time extent and
 * an occurrence widget's matching values come from its own pipeline.
 */
async function pick_conditions(widget, pick, bounds, catalog) {
  const conditions = [];
  const criteria = [];
  const label_of = (field_id) => field_label_text(catalog.fields_by_id.get(field_id)) || field_id;
  const add = (field_id, value) => {
    if (!field_id || !catalog.fields_by_id.has(field_id) || value === undefined || value === null || value === "") return;
    conditions.push(eq(field_id, clean(value)));
    criteria.push({ field_id, field_label: label_of(field_id), value: clean(value) });
  };
  const group = widget.group_by && widget.group_by.field_id;
  const split = widget.split_by && widget.split_by.field_id;
  const pattern = widget.pattern_by && widget.pattern_by.field_id;
  const picked = pick && typeof pick === "object" ? pick : null;

  if (is_occurrences(widget)) {
    const key_field = widget.metric.field_id;
    if (picked && ["category", "legend", "tree"].includes(picked.kind)) {
      // One counted value, with the "same" values its group shares.
      add(key_field, picked.record_key !== undefined ? picked.record_key : picked.label !== undefined ? picked.label : picked.name);
      Object.entries(picked.shared && typeof picked.shared === "object" ? picked.shared : {}).forEach(([field_id, value]) => add(field_id, value));
      return { conditions, criteria };
    }
    // The whole widget: only the values that met its rule (what it counted).
    const has_rule = !!(widget.occurrence_rule && widget.occurrence_rule.operator);
    if (has_rule && widget.occurrence_scope !== "all" && catalog.fields_by_id.has(key_field)) {
      const rows = await pipelines.occurrence_rows(widget, bounds, catalog);
      const keys = rows.filter((row) => row.matches).map((row) => row._id).filter((key) => key !== undefined && key !== null && key !== "").slice(0, MAX_OCCURRENCE_KEYS);
      conditions.push({ [`data.${key_field}`]: { $in: keys.flatMap((key) => value_candidates(key)) } });
      criteria.push({ field_id: key_field, field_label: label_of(key_field), value: `${keys.length} values`, is_rule: true });
    }
    return { conditions, criteria };
  }

  if (!picked) return { conditions, criteria };
  if (picked.kind === "category") {
    add(group, picked.label);
    add(split, picked.series);
    add(pattern, picked.pattern);
  } else if (picked.kind === "legend") {
    const legend = widget.legend_by && widget.legend_by.field_id;
    add(legend || split, picked.label);
  } else if (picked.kind === "tree") {
    const parent = parent_field_id_of(catalog.fields_by_id.get(group), catalog.fields_by_id);
    // In a nested treemap the first level is the PARENT field's values.
    if (parent && picked.depth === 1) add(parent, picked.name);
    else {
      add(group, picked.name);
      if (picked.parent && parent) add(parent, picked.parent);
    }
  } else if (picked.kind === "point") {
    [
      [widget.x_field_id, picked.x],
      [widget.y_field_id, picked.y],
    ].forEach(([field_id, value]) => {
      if (!field_id || !Number.isFinite(Number(value))) return;
      conditions.push({ $expr: { $eq: [numeric_expr(field_id), Number(value)] } });
      criteria.push({ field_id, field_label: label_of(field_id), value: Number(value) });
    });
  } else if (picked.kind === "time" && typeof picked.label === "string") {
    const range = await time_bucket_range(widget, bounds, picked.label);
    if (range) {
      // An OVER TIME widget is bucketed by its own over_time field, which
      // is not what group_by holds - reading group_by here resolved the
      // clicked bucket against the wrong field entirely, so the rows behind
      // a point could come from outside both the bucket and the range.
      const over_time = widget.over_time && widget.over_time.enabled === true ? widget.over_time : null;
      const timed_field = over_time ? over_time.field_id || SUBMITTED_AT_FIELD : group;
      const source = timed_field && timed_field !== SUBMITTED_AT_FIELD ? timed_field : SUBMITTED_AT_FIELD;
      const expr = pipelines.time_source_expr(source, widget.tracking);
      conditions.push({ $expr: { $and: [{ $gte: [expr, range.start] }, { $lte: [expr, range.end] }] } });
      criteria.push({ field_id: source, field_label: source === SUBMITTED_AT_FIELD ? "" : label_of(source), value: picked.label, is_time: true });
    }
  }
  return { conditions, criteria };
}

/**
 * The answerable fields a records table may show: the active version's own
 * fields, in its order, then the fields only older versions carry (records
 * submitted back then still answer them), labelled in the asked language.
 * A share link may allow only some of them - `allowed` then lists the field
 * ids, and nothing else ever leaves the server.
 */
async function table_columns(form_group_id, form_version, language, allowed) {
  const text = (label) => (label && (label[language] || label.en || label.kn || label.fr)) || "";
  const versions = await forms_model.get_versions_by_group(form_group_id);
  const ordered = [form_version].concat((versions || []).filter((entry) => entry && entry.version !== form_version.version));
  const seen = new Set();
  const columns = [];
  ordered.forEach((version) => {
    flatten_fields((version && version.schema && version.schema.fields) || [])
      .filter((field) => field && field.id && !NON_DATA_TYPES.includes(field.type) && !seen.has(field.id))
      .forEach((field) => {
        seen.add(field.id);
        columns.push({ id: field.id, type: field.type, label: text(field.label) || field_label_text(field) });
      });
  });
  const keep = Array.isArray(allowed) && allowed.length > 0 ? new Set(allowed) : null;
  return keep ? columns.filter((column) => keep.has(column.id)) : columns;
}

/** Each record cut down to the columns being sent - a hidden field never leaves the server. */
function project_items(items, columns) {
  const ids = columns.map((column) => column.id);
  return items.map((item) => {
    const data = {};
    ids.forEach((id) => {
      if (item.data && item.data[id] !== undefined) data[id] = item.data[id];
    });
    return { _id: item._id, submitted_at: item.submitted_at, version: item.version, data };
  });
}

/**
 * Everything a records request resolves to before rows are read: the
 * Mongo match, the criteria the rows satisfy, the period and the columns.
 * { invalid } when the widget itself does not pass validation.
 */
async function records_query(body, form_group_id, form_version, project_id, forced_filters, allowed_fields) {
  const widget = sanitize_widget(body.widget);
  if (!widget) return { invalid: ["widget missing"] };
  widget.form_group_id = form_group_id;
  const check = validate_dashboard([widget], new Map([[form_group_id, form_version]]), project_id);
  if (!check.valid) return { invalid: check.errors };

  const catalog = build_field_catalog(form_version.schema);
  const applied = merge_applied(sanitize_applied_filters(body.filters), forced_filters || []);
  const shaped = ungrouped_widget(apply_board_filters(widget, applied, catalog).widget);
  shaped.tracking = form_version.tracking || null;
  const period_override = sanitize_period_override(body.period);
  const bounds = effective_bounds(shaped, period_override);
  const picked = await pick_conditions(shaped, body.pick, bounds, catalog);
  // The rows are read through the same opening stages as the widget itself
  // (a tracked form's values as of the period's end included), so what was
  // clicked is matched against exactly what was charted.
  const stages = base_stages(shaped, bounds).concat(picked.conditions.length > 0 ? [{ $match: { $and: picked.conditions } }] : []);

  const label_of = (field_id) => field_label_text(catalog.fields_by_id.get(field_id)) || field_id;
  const criteria = (shaped.filters || [])
    .filter((filter) => filter.operator === "eq" && catalog.fields_by_id.has(filter.field_id))
    .map((filter) => ({ field_id: filter.field_id, field_label: label_of(filter.field_id), value: filter.value }))
    .concat(picked.criteria);
  const columns = await table_columns(form_group_id, form_version, body.language || "en", allowed_fields);
  return { stages, criteria, period: bounds ? { start: bounds.start, end: bounds.end } : null, columns };
}

const ROW_PROJECTION = { $project: { data: 1, submitted_at: 1, version: 1 } };

async function compute_widget_records(body, form_group_id, form_version, project_id, forced_filters, allowed_fields) {
  const query = await records_query(body, form_group_id, form_version, project_id, forced_filters, allowed_fields);
  if (query.invalid) return query;
  const page = Math.max(1, parseInt(body.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(body.limit, 10) || DEFAULT_PAGE_SIZE));
  const pipeline = query.stages.concat([
    {
      $facet: {
        items: [{ $sort: { submitted_at: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, ROW_PROJECTION],
        total: [{ $count: "count" }],
      },
    },
  ]);
  const [result] = await get_db().collection(COLLECTION).aggregate(pipeline, { allowDiskUse: true }).toArray();
  const items = (result && result.items) || [];
  const total = result && result.total && result.total[0] ? result.total[0].count : 0;
  return { items: project_items(items, query.columns), total, page, limit, columns: query.columns, criteria: query.criteria, period: query.period };
}

/** Every matching record (capped), oldest first, for the Excel export. */
async function collect_widget_records(body, form_group_id, form_version, project_id, forced_filters, allowed_fields) {
  const query = await records_query(body, form_group_id, form_version, project_id, forced_filters, allowed_fields);
  if (query.invalid) return query;
  const items = await get_db()
    .collection(COLLECTION)
    .aggregate(query.stages.concat([{ $sort: { submitted_at: 1, _id: 1 } }, { $limit: MAX_EXPORT_ROWS }, ROW_PROJECTION]), { allowDiskUse: true })
    .toArray();
  return { items: project_items(items, query.columns), columns: query.columns, criteria: query.criteria, period: query.period };
}

module.exports = {
  compute_widget_records,
  collect_widget_records,
  MAX_EXPORT_ROWS,
};
