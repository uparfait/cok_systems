const { AGGREGATIONS, KPI_ONLY_AGGREGATIONS, NUMERIC_AGGREGATIONS, TABLE_MODES, TABLE_LIMITS, SORT_DIRECTIONS, TEXT_ALIGNS, TEXT_SIZES, TEXT_LIMITS, MAX_PINNED_FIELDS, SUBMITTED_AT_FIELD } = require("./constants.js");
const { is_categorical } = require("./field_catalog.js");
const { can_filter_field } = require("./board_filters.js");
const { parse_text_variables, variable_fields } = require("./text_data.js");

/**
 * The rules of the widget keys added for report-style boards - text
 * blocks, tables and pinned fields. Called from widget_validation.js, which
 * hands over the shared filter check so the same filter rules apply to a
 * table column's filters as to a widget's own.
 */

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const clean = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * A text block is words: it reads no field of its own and cannot be read
 * over time. The live figures written into its body are checked here -
 * their grammar, and that every field they name is one of the form's.
 */
function validate_text(widget, catalog, errors, describe) {
  if (widget.group_by || widget.split_by || widget.legend_by || widget.pattern_by) {
    errors.push(`${describe}: a text block reads no fields`);
  }
  if (widget.over_time && widget.over_time.enabled === true) {
    errors.push(`${describe}: a text block cannot be read over time`);
  }
  const text = widget.text && typeof widget.text === "object" ? widget.text : {};
  const heading = clean(text.heading);
  const body = typeof text.body === "string" ? text.body.trim() : "";
  if (!heading && !body) errors.push(`${describe}: a text block needs a heading or a body`);
  if (heading.length > TEXT_LIMITS.MAX_HEADING) errors.push(`${describe}: the heading must stay under ${TEXT_LIMITS.MAX_HEADING} characters`);
  if (body.length > TEXT_LIMITS.MAX_BODY) errors.push(`${describe}: the body must stay under ${TEXT_LIMITS.MAX_BODY} characters`);
  if (text.align !== undefined && !TEXT_ALIGNS.includes(text.align)) errors.push(`${describe}: text is aligned ${TEXT_ALIGNS.join(", ")}`);
  if (text.size !== undefined && !TEXT_SIZES.includes(text.size)) errors.push(`${describe}: text is sized ${TEXT_SIZES.join(", ")}`);
  if (text.accent !== undefined && !HEX_COLOR.test(String(text.accent))) errors.push(`${describe}: the accent must be a six-digit hex colour`);
  const parsed = parse_text_variables(body);
  parsed.problems.forEach((problem) => errors.push(`${describe}: ${problem}`));
  parsed.variables.forEach((variable) => {
    variable_fields(variable).forEach((field_id) => {
      if (!catalog.fields_by_id.has(field_id)) errors.push(`${describe}: ${variable.token} names an unknown field ${field_id}`);
    });
  });
}

/** One measure column of a summary table. */
function validate_column(column, index, catalog, errors, describe, check_filters) {
  const label = `${describe}: column ${index + 1}`;
  if (!column || typeof column !== "object") {
    errors.push(`${label} is not a valid column`);
    return;
  }
  const aggregation = column.aggregation || "count";
  if (!AGGREGATIONS.includes(aggregation)) {
    errors.push(`${label} uses an unknown formula`);
    return;
  }
  if (KPI_ONLY_AGGREGATIONS.includes(aggregation) || aggregation === "occurrences") {
    errors.push(`${label}: ${aggregation} cannot be a table column`);
  }
  const needs_field = NUMERIC_AGGREGATIONS.includes(aggregation) || aggregation === "count_distinct";
  if (needs_field && !catalog.fields_by_id.has(column.field_id)) errors.push(`${label}: ${aggregation} needs a field of the form`);
  if (aggregation === "count" && column.field_id && !catalog.fields_by_id.has(column.field_id)) errors.push(`${label}: unknown count field`);
  if (column.label && String(column.label).length > TABLE_LIMITS.MAX_COLUMN_LABEL) errors.push(`${label}: the label must stay under ${TABLE_LIMITS.MAX_COLUMN_LABEL} characters`);
  check_filters(Array.isArray(column.filters) ? column.filters : [], label);
}

/**
 * A table's settings. A RECORDS table names the fields it shows and a page
 * size between ten and a hundred; a SUMMARY table groups by a choice field
 * and takes its columns from a split field OR from measures, never both.
 */
function validate_table(widget, catalog, errors, describe, check_filters) {
  const settings = widget.table && typeof widget.table === "object" ? widget.table : null;
  if (!settings || !TABLE_MODES.includes(settings.mode)) {
    errors.push(`${describe}: a table is either a records table or a summary table`);
    return;
  }
  if (widget.over_time && widget.over_time.enabled === true) errors.push(`${describe}: a table cannot be read over time`);
  if (widget.legend_by || widget.pattern_by) errors.push(`${describe}: a table takes no legend or pattern field`);
  if (settings.mode === "records") {
    const fields = Array.isArray(settings.fields) ? settings.fields : [];
    if (fields.length === 0) errors.push(`${describe}: a records table needs at least one field to show`);
    if (fields.length > TABLE_LIMITS.MAX_FIELDS) errors.push(`${describe}: a records table shows at most ${TABLE_LIMITS.MAX_FIELDS} fields`);
    fields.forEach((field_id, index) => {
      if (!catalog.fields_by_id.has(field_id)) errors.push(`${describe}: field ${index + 1} of the table is unknown`);
    });
    const page_size = Number(settings.page_size);
    if (!Number.isInteger(page_size) || page_size < TABLE_LIMITS.MIN_PAGE_SIZE || page_size > TABLE_LIMITS.MAX_PAGE_SIZE) {
      errors.push(`${describe}: rows per page must be between ${TABLE_LIMITS.MIN_PAGE_SIZE} and ${TABLE_LIMITS.MAX_PAGE_SIZE}`);
    }
    const sort = settings.sort || {};
    if (sort.field_id && sort.field_id !== SUBMITTED_AT_FIELD && !catalog.fields_by_id.has(sort.field_id)) errors.push(`${describe}: the table is sorted by an unknown field`);
    if (sort.direction && !SORT_DIRECTIONS.includes(sort.direction)) errors.push(`${describe}: a table is sorted asc or desc`);
    if ((widget.group_by && widget.group_by.field_id) || (widget.split_by && widget.split_by.field_id)) errors.push(`${describe}: a records table takes no group or split field`);
    return;
  }
  const group_id = widget.group_by && widget.group_by.field_id;
  if (!group_id || !is_categorical(catalog, group_id)) errors.push(`${describe}: a summary table groups by a choice field of the form`);
  const split_id = widget.split_by && widget.split_by.field_id;
  const columns = Array.isArray(settings.columns) ? settings.columns : [];
  if (split_id) {
    const aggregation = (widget.metric && widget.metric.aggregation) || "count";
    if (KPI_ONLY_AGGREGATIONS.includes(aggregation) || aggregation === "occurrences") errors.push(`${describe}: ${aggregation} cannot fill the cells of a table`);
    if (!is_categorical(catalog, split_id)) errors.push(`${describe}: the table's columns come from a choice field`);
    if (split_id === group_id) errors.push(`${describe}: the split field must differ from the group field`);
    if (columns.length > 0) errors.push(`${describe}: a summary table takes its columns from the split field OR from measures, not both`);
    return;
  }
  if (columns.length === 0) errors.push(`${describe}: a summary table needs a split field or at least one measure column`);
  if (columns.length > TABLE_LIMITS.MAX_COLUMNS) errors.push(`${describe}: a summary table holds at most ${TABLE_LIMITS.MAX_COLUMNS} columns`);
  const keys = new Set();
  columns.forEach((column, index) => {
    validate_column(column, index, catalog, errors, describe, check_filters);
    const key = column && column.key;
    if (key && keys.has(key)) errors.push(`${describe}: column ${index + 1} repeats the key of another column`);
    if (key) keys.add(key);
  });
}

/** The fields a widget is pinned on: known to the form, and able to filter the board. */
function validate_pinned_fields(widget, catalog, errors, describe) {
  const pinned = Array.isArray(widget.pinned_fields) ? widget.pinned_fields : [];
  if (pinned.length > MAX_PINNED_FIELDS) errors.push(`${describe}: at most ${MAX_PINNED_FIELDS} pinned fields`);
  pinned.forEach((field_id, index) => {
    const field = catalog.fields_by_id.get(field_id);
    if (!field) errors.push(`${describe}: pinned field ${index + 1} is unknown`);
    else if (!can_filter_field(field)) errors.push(`${describe}: pinned field ${index + 1} is not a field that can filter the board`);
  });
}

module.exports = {
  validate_text,
  validate_table,
  validate_pinned_fields,
};
