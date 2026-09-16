const { get_db } = require("../db_connection/db.js");
const { flatten_fields } = require("../jsonlogic/dependency_graph.js");
const { TEST_DATA_FLAG } = require("../models/submissions_model.js");
const { sanitize_widget, sanitize_period_override } = require("./sanitize.js");
const { validate_dashboard } = require("./widget_validation.js");
const { build_match_stage, effective_bounds, value_candidates, numeric_expr } = require("./match_stage.js");
const { build_field_catalog, field_label_text, parent_field_id_of } = require("./field_catalog.js");
const { sanitize_applied_filters, merge_applied, apply_board_filters } = require("./board_filters.js");
const { time_bucket_range } = require("./widget_data.js");
const pipelines = require("./pipelines.js");
const { SUBMITTED_AT_FIELD } = require("./constants.js");

const COLLECTION = "dcs_submissions";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const NON_DATA_TYPES = ["section", "paragraph", "header", "file", "group", "image_block", "horizontal_line"];

/**
 * The records behind a widget: the submissions its number or chart was
 * computed from - under the widget's own filters, the board's applied
 * filters and the period - narrowed further by what the viewer clicked
 * (a bar or slice = one category value, a segment or legend entry = one
 * split value, a point of a line = one time bucket, a scatter point = its
 * two numbers, a treemap tile = its value under its parent). Paged, newest
 * first, with the fields' columns and the criteria the rows match so the
 * table can highlight them.
 */

const clean = (value) => (typeof value === "string" ? value.trim() : value);
const eq = (field_id, value) => ({ [`data.${field_id}`]: { $in: value_candidates(value) } });

/**
 * The extra conditions of one click, plus the criteria they add. Async
 * because a time bucket is resolved from the widget's own time extent.
 */
async function pick_conditions(widget, pick, bounds, catalog) {
  const conditions = [];
  const criteria = [];
  if (!pick || typeof pick !== "object") return { conditions, criteria };
  const label_of = (field_id) => field_label_text(catalog.fields_by_id.get(field_id)) || field_id;
  const add = (field_id, value) => {
    if (!field_id || !catalog.fields_by_id.has(field_id) || value === undefined || value === null || value === "") return;
    conditions.push(eq(field_id, clean(value)));
    criteria.push({ field_id, field_label: label_of(field_id), value: clean(value) });
  };
  const group = widget.group_by && widget.group_by.field_id;
  const split = widget.split_by && widget.split_by.field_id;
  const pattern = widget.pattern_by && widget.pattern_by.field_id;

  if (pick.kind === "category") {
    add(group, pick.label);
    add(split, pick.series);
    add(pattern, pick.pattern);
  } else if (pick.kind === "legend") {
    const legend = widget.legend_by && widget.legend_by.field_id;
    add(legend || split, pick.label);
  } else if (pick.kind === "tree") {
    add(group, pick.name);
    const parent = parent_field_id_of(catalog.fields_by_id.get(group), catalog.fields_by_id);
    if (pick.parent && parent) add(parent, pick.parent);
  } else if (pick.kind === "point") {
    [
      [widget.x_field_id, pick.x],
      [widget.y_field_id, pick.y],
    ].forEach(([field_id, value]) => {
      if (!field_id || !Number.isFinite(Number(value))) return;
      conditions.push({ $expr: { $eq: [numeric_expr(field_id), Number(value)] } });
      criteria.push({ field_id, field_label: label_of(field_id), value: Number(value) });
    });
  } else if (pick.kind === "time" && typeof pick.label === "string") {
    const range = await time_bucket_range(widget, bounds, pick.label);
    if (range) {
      const source = group && group !== SUBMITTED_AT_FIELD ? group : SUBMITTED_AT_FIELD;
      const expr = pipelines.time_source_expr(source);
      conditions.push({ $expr: { $and: [{ $gte: [expr, range.start] }, { $lte: [expr, range.end] }] } });
      criteria.push({ field_id: source, field_label: source === SUBMITTED_AT_FIELD ? "" : label_of(source), value: pick.label, is_time: true });
    }
  }
  return { conditions, criteria };
}

/** The answerable fields of the form's active version, as table columns. */
function columns_of(form_version) {
  return flatten_fields((form_version.schema && form_version.schema.fields) || [])
    .filter((field) => field && field.id && !NON_DATA_TYPES.includes(field.type))
    .map((field) => ({ id: field.id, type: field.type, label: field_label_text(field) }));
}

async function compute_widget_records(body, form_group_id, form_version, project_id, forced_filters) {
  const widget = sanitize_widget(body.widget);
  if (!widget) return { invalid: ["widget missing"] };
  widget.form_group_id = form_group_id;
  const check = validate_dashboard([widget], new Map([[form_group_id, form_version]]), project_id);
  if (!check.valid) return { invalid: check.errors };

  const catalog = build_field_catalog(form_version.schema);
  const applied = merge_applied(sanitize_applied_filters(body.filters), forced_filters || []);
  const shaped = apply_board_filters(widget, applied, catalog).widget;
  const period_override = sanitize_period_override(body.period);
  const bounds = effective_bounds(shaped, period_override);
  const base = build_match_stage(shaped, bounds).$match;
  const picked = await pick_conditions(shaped, body.pick, bounds, catalog);
  const match = picked.conditions.length > 0 ? { $and: [base].concat(picked.conditions) } : base;

  const page = Math.max(1, parseInt(body.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(body.limit, 10) || DEFAULT_PAGE_SIZE));
  const collection = get_db().collection(COLLECTION);
  const [items, total] = await Promise.all([
    collection
      .find(match, { projection: { data: 1, submitted_at: 1, version: 1 } })
      .sort({ submitted_at: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    collection.countDocuments(match),
  ]);
  items.forEach((item) => {
    delete item[TEST_DATA_FLAG];
  });

  // The criteria: every equality the rows match (own and board filters), then the click.
  const label_of = (field_id) => field_label_text(catalog.fields_by_id.get(field_id)) || field_id;
  const criteria = (shaped.filters || [])
    .filter((filter) => filter.operator === "eq" && catalog.fields_by_id.has(filter.field_id))
    .map((filter) => ({ field_id: filter.field_id, field_label: label_of(filter.field_id), value: filter.value }))
    .concat(picked.criteria);

  return { items, total, page, limit, columns: columns_of(form_version), criteria, period: bounds ? { start: bounds.start, end: bounds.end } : null };
}

module.exports = {
  compute_widget_records,
};
