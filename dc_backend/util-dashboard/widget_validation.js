const {
  CHART_TYPES,
  CHART_KINDS,
  AGGREGATIONS,
  KPI_ONLY_AGGREGATIONS,
  NUMERIC_AGGREGATIONS,
  FILTER_OPERATORS,
  PERIOD_PRESETS,
  SORT_OPTIONS,
  WIDGET_SIZES,
  TIME_GRANULARITIES,
  LIMITS,
} = require("./constants.js");
const { build_field_catalog, is_categorical, is_numeric, is_time_source } = require("./field_catalog.js");

/**
 * Validates a dashboard's widget list against the real schemas of the forms
 * it charts. Every rule the builder enforces visually is re-checked here so
 * a hand-crafted request can never save a widget its chart cannot render.
 * Returns { valid, errors } with one plain message per violation.
 */

function is_scalar(value) {
  return ["string", "number", "boolean"].includes(typeof value);
}

function validate_metric(widget, catalog, errors, describe) {
  const metric = widget.metric || { aggregation: "count" };
  if (!AGGREGATIONS.includes(metric.aggregation)) {
    errors.push(`${describe}: unknown aggregation`);
    return;
  }
  if (KPI_ONLY_AGGREGATIONS.includes(metric.aggregation) && widget.chart_type !== "kpi") {
    errors.push(`${describe}: ${metric.aggregation} is only available on KPI cards`);
  }
  // A numeric formula runs on ANY real field of the form: answers that
  // cannot be read as numbers are SKIPPED at aggregation time (and counted
  // back to the card), so the formula catalog is never filtered by type.
  if (NUMERIC_AGGREGATIONS.includes(metric.aggregation) && !catalog.fields_by_id.has(metric.field_id)) {
    errors.push(`${describe}: ${metric.aggregation} needs a field of the form`);
  }
  // Count distinct works on any real field too; plain count takes an
  // optional field (count its non-empty answers) or none (count records).
  if (metric.aggregation === "count_distinct" && !catalog.fields_by_id.has(metric.field_id)) {
    errors.push(`${describe}: count distinct needs a field of the form`);
  }
  if (metric.aggregation === "count" && metric.field_id && !catalog.fields_by_id.has(metric.field_id)) {
    errors.push(`${describe}: unknown count field`);
  }
}

function validate_shape_for_kind(widget, definition, catalog, errors, describe) {
  const kind = definition.kind;

  if (kind === CHART_KINDS.CATEGORY || kind === CHART_KINDS.TREE) {
    if (!widget.group_by || !is_categorical(catalog, widget.group_by.field_id)) {
      errors.push(`${describe}: group by must be a choice field of the form`);
    }
  }
  if (kind === CHART_KINDS.TIME) {
    // Line/area charts also accept a CHOICE field: any category chart can
    // be flipped into a line/area look and back - the data pipeline then
    // treats it as a category chart (see compute_widget_data).
    const group_id = widget.group_by && widget.group_by.field_id;
    if (!widget.group_by || (!is_time_source(catalog, group_id) && !is_categorical(catalog, group_id))) {
      errors.push(`${describe}: time charts group by submitted_at, a date field, or a choice field`);
    }
    const granularity = widget.group_by && widget.group_by.granularity;
    if (granularity && !TIME_GRANULARITIES.includes(granularity)) {
      errors.push(`${describe}: unknown time granularity`);
    }
  }
  if (kind === CHART_KINDS.POINT) {
    if (!is_numeric(catalog, widget.x_field_id) || !is_numeric(catalog, widget.y_field_id)) {
      errors.push(`${describe}: scatter charts need two numeric fields`);
    }
    if (widget.chart_type === "bubble" && !is_numeric(catalog, widget.size_field_id)) {
      errors.push(`${describe}: bubble charts need a numeric size field`);
    }
  }

  const split_field = widget.split_by && widget.split_by.field_id;
  if (definition.split === "required" && !split_field) {
    errors.push(`${describe}: this chart type needs a split field`);
  }
  if (definition.split === "none" && split_field) {
    errors.push(`${describe}: this chart type does not take a split field`);
  }
  if (split_field) {
    if (!is_categorical(catalog, split_field)) {
      errors.push(`${describe}: split by must be a choice field of the form`);
    }
    if (widget.group_by && split_field === widget.group_by.field_id) {
      errors.push(`${describe}: split field must differ from the group field`);
    }
  }
}

function validate_filters(widget, catalog, errors, describe) {
  const filters = widget.filters || [];
  if (!Array.isArray(filters) || filters.length > LIMITS.MAX_FILTERS) {
    errors.push(`${describe}: too many filters`);
    return;
  }
  filters.forEach((filter, index) => {
    if (!filter || !catalog.fields_by_id.has(filter.field_id)) {
      errors.push(`${describe}: filter ${index + 1} uses an unknown field`);
      return;
    }
    if (!FILTER_OPERATORS.includes(filter.operator)) {
      errors.push(`${describe}: filter ${index + 1} uses an unknown operator`);
      return;
    }
    if (!is_scalar(filter.value) || String(filter.value).trim() === "") {
      errors.push(`${describe}: filter ${index + 1} needs a value`);
      return;
    }
    if (["gt", "gte", "lt", "lte"].includes(filter.operator) && !Number.isFinite(Number(filter.value))) {
      errors.push(`${describe}: filter ${index + 1} compares numbers only`);
    }
  });
}

function validate_period(widget, errors, describe) {
  const period = widget.period;
  if (period === null || period === undefined) return;
  if (typeof period !== "object" || !PERIOD_PRESETS.includes(period.preset)) {
    errors.push(`${describe}: unknown period`);
    return;
  }
  if (period.preset === "custom" && (!period.from || Number.isNaN(new Date(period.from).getTime()))) {
    errors.push(`${describe}: a custom period needs a valid from date`);
  }
}

function validate_widget(widget, index, form_versions_by_group, project_id, errors) {
  const describe = `Widget ${index + 1}${widget && widget.title ? ` (${widget.title})` : ""}`;

  if (!widget || typeof widget !== "object") {
    errors.push(`${describe}: not a valid widget`);
    return;
  }
  if (typeof widget.id !== "string" || !widget.id.trim()) {
    errors.push(`${describe}: missing id`);
  }
  if (typeof widget.title !== "string" || !widget.title.trim() || widget.title.length > LIMITS.MAX_TITLE_LENGTH) {
    errors.push(`${describe}: title is required (max ${LIMITS.MAX_TITLE_LENGTH} characters)`);
  }
  if (widget.description !== null && widget.description !== undefined) {
    if (typeof widget.description !== "string" || widget.description.length > 300) {
      errors.push(`${describe}: description must stay under 300 characters`);
    }
  }
  const definition = CHART_TYPES[widget.chart_type];
  if (!definition) {
    errors.push(`${describe}: unknown chart type`);
    return;
  }
  const form_version = form_versions_by_group.get(widget.form_group_id);
  if (!form_version || form_version.project_id !== project_id.toString()) {
    errors.push(`${describe}: the form does not belong to this project`);
    return;
  }
  if (widget.sort !== undefined && !SORT_OPTIONS.includes(widget.sort)) {
    errors.push(`${describe}: unknown sort option`);
  }
  if (widget.size !== undefined && !WIDGET_SIZES.includes(widget.size)) {
    errors.push(`${describe}: unknown size`);
  }
  if (widget.limit !== undefined) {
    const limit = Number(widget.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > LIMITS.MAX_CATEGORY_LIMIT) {
      errors.push(`${describe}: limit must be between 1 and ${LIMITS.MAX_CATEGORY_LIMIT}`);
    }
  }

  const catalog = build_field_catalog(form_version.schema);
  validate_metric(widget, catalog, errors, describe);
  validate_shape_for_kind(widget, definition, catalog, errors, describe);
  validate_filters(widget, catalog, errors, describe);
  validate_period(widget, errors, describe);
}

/**
 * Validates the whole widget list of one dashboard save.
 * form_versions_by_group maps form_group_id -> that form's active version.
 */
function validate_dashboard(widgets, form_versions_by_group, project_id) {
  const errors = [];
  if (!Array.isArray(widgets)) {
    return { valid: false, errors: ["widgets must be a list"] };
  }
  if (widgets.length > LIMITS.MAX_WIDGETS) {
    errors.push(`A dashboard holds at most ${LIMITS.MAX_WIDGETS} widgets`);
  }
  const seen_ids = new Set();
  widgets.forEach((widget, index) => {
    if (widget && typeof widget.id === "string") {
      if (seen_ids.has(widget.id)) errors.push(`Widget ${index + 1}: duplicate id`);
      seen_ids.add(widget.id);
    }
    validate_widget(widget, index, form_versions_by_group, project_id, errors);
  });
  return { valid: errors.length === 0, errors };
}

module.exports = {
  validate_dashboard,
};
