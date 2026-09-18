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
  MAP_LEVELS,
  TIME_GRANULARITIES,
  OVER_TIME_TYPES,
  OVER_TIME_AXES,
  MAX_CANVAS_DEPTH,
  OCCURRENCE_OPERATORS,
  OCCURRENCE_SCOPES,
  LIMITS,
} = require("./constants.js");
const { build_field_catalog, is_categorical, is_numeric, is_time_source } = require("./field_catalog.js");

// A KPI card's icon is stored as "<library>:<icon name>" ("lucide:Cat",
// "tabler:IconChartBar"); a bare name predates the library prefix (Tabler).
const ICON_NAME_PATTERN = /^(?:[a-z0-9_-]{1,40}:)?[A-Za-z0-9_-]{1,100}$/;

// The split charts that can texture each segment by a third choice field.
const PATTERN_CHART_TYPES = ["grouped_column", "stacked_column", "stacked_100", "grouped_bar", "stacked_bar", "stacked_bar_100"];

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
  if (metric.aggregation === "occurrences" && !catalog.fields_by_id.has(metric.field_id)) {
    errors.push(`${describe}: count occurrences needs a field of the form`);
  }
}

const is_occurrences = (widget) => ((widget.metric && widget.metric.aggregation) || "count") === "occurrences";
// The looks a "count occurrences" widget can take: a KPI card, or any chart
// with ONE series - the counted values are the categories, so nothing is
// left to group, split or plot over time.
const OCCURRENCE_CHART_TYPES = ["kpi", "bar", "column", "lollipop", "dot_plot", "pie", "donut", "waffle", "treemap", "line", "area"];

/**
 * The options of a "count occurrences" widget: every display field must be
 * a field of the form (at most MAX_DISPLAY_FIELDS), the threshold a known
 * operator with a number, the scope one of the two, and the chart a
 * single-series look.
 */
function validate_occurrences(widget, catalog, errors, describe) {
  if (!is_occurrences(widget)) return;
  if (!OCCURRENCE_CHART_TYPES.includes(widget.chart_type)) {
    errors.push(`${describe}: count occurrences draws a KPI card or a single-series chart only`);
  }
  if (widget.split_by && widget.split_by.field_id) errors.push(`${describe}: count occurrences takes no split field`);
  if (widget.legend_by && widget.legend_by.field_id) errors.push(`${describe}: count occurrences lists its own values - it takes no legend field`);
  const display = Array.isArray(widget.display_fields) ? widget.display_fields : [];
  if (display.length > LIMITS.MAX_DISPLAY_FIELDS) errors.push(`${describe}: at most ${LIMITS.MAX_DISPLAY_FIELDS} display fields`);
  display.forEach((id, index) => {
    if (!catalog.fields_by_id.has(id)) errors.push(`${describe}: display field ${index + 1} is unknown`);
  });
  const same = Array.isArray(widget.same_fields) ? widget.same_fields : [];
  if (same.length > LIMITS.MAX_DISPLAY_FIELDS) errors.push(`${describe}: at most ${LIMITS.MAX_DISPLAY_FIELDS} "same" conditions`);
  same.forEach((entry, index) => {
    if (!entry || !catalog.fields_by_id.has(entry.field_id)) errors.push(`${describe}: "same" condition ${index + 1} uses an unknown field`);
    else if (entry.field_id === (widget.metric && widget.metric.field_id)) errors.push(`${describe}: "same" condition ${index + 1} repeats the counted field`);
  });
  if (widget.display_separator !== undefined && (typeof widget.display_separator !== "string" || widget.display_separator.length > 10)) {
    errors.push(`${describe}: the label separator must be text of at most 10 characters`);
  }
  const rule = widget.occurrence_rule;
  if (rule) {
    if (!OCCURRENCE_OPERATORS.includes(rule.operator)) errors.push(`${describe}: unknown occurrence operator`);
    if (!Number.isFinite(Number(rule.value)) || Number(rule.value) < 0) errors.push(`${describe}: the occurrence threshold must be a number of zero or more`);
  }
  if (widget.occurrence_scope !== undefined && !OCCURRENCE_SCOPES.includes(widget.occurrence_scope)) {
    errors.push(`${describe}: unknown occurrence scope`);
  }
}

function validate_shape_for_kind(widget, definition, catalog, errors, describe) {
  const kind = definition.kind;
  // A canvas reads nothing: it is a place other widgets sit in. It takes no
  // formula, no field and no period, so none of the checks below apply and
  // anything it was given by mistake is simply refused.
  if (kind === CHART_KINDS.CANVAS) {
    if (widget.group_by || widget.split_by || widget.legend_by || widget.pattern_by) {
      errors.push(`${describe}: a canvas holds widgets, it does not read fields`);
    }
    if (widget.over_time && widget.over_time.enabled === true) {
      errors.push(`${describe}: a canvas cannot be read over time`);
    }
    return;
  }
  // A map is drawn one of two ways, and each asks for its own things. A
  // HEAT map spreads the positions records were collected at, so it needs a
  // field that captured one - an administrative level says nothing about
  // where inside itself an answer came from, and cannot make heat. A WORLD
  // map fills named boundaries, so it needs the level and the field whose
  // answers name them.
  if (widget.chart_type === "map" && widget.map && widget.map.mode === "heat") {
    const point_field = widget.map.point_field_id;
    if (!point_field || !(catalog.geo_ids || []).includes(point_field)) {
      errors.push(`${describe}: a heat map needs the form's map location field, the one that records latitude and longitude`);
    }
    if (widget.map.weight_field_id && !is_numeric(catalog, widget.map.weight_field_id)) {
      errors.push(`${describe}: a heat map can only be weighed by a number field`);
    }
    if (widget.split_by && widget.split_by.field_id && !is_categorical(catalog, widget.split_by.field_id)) {
      errors.push(`${describe}: a heat map splits by a choice field`);
    }
    return;
  }
  if (widget.chart_type === "map") {
    const level = widget.map && widget.map.level;
    if (!MAP_LEVELS.includes(level)) errors.push(`${describe}: a map needs one of these levels: ${MAP_LEVELS.join(", ")}`);
    if (!widget.group_by || !is_categorical(catalog, widget.group_by.field_id)) errors.push(`${describe}: a map groups by the form field holding the place names`);
  }
  // Occurrences group by their own counted field: group_by is not needed
  // (and ignored), whatever look the widget takes.
  if (is_occurrences(widget) && kind !== CHART_KINDS.KPI) {
    validate_occurrences(widget, catalog, errors, describe);
    return;
  }
  if (is_occurrences(widget)) validate_occurrences(widget, catalog, errors, describe);

  // Group by is optional everywhere: without it a widget draws its split
  // field, or - with neither - the single total of what it selects.
  if (kind === CHART_KINDS.CATEGORY || kind === CHART_KINDS.TREE) {
    if (widget.group_by && widget.group_by.field_id && !is_categorical(catalog, widget.group_by.field_id)) {
      errors.push(`${describe}: group by must be a choice field of the form`);
    }
  }
  if (kind === CHART_KINDS.TIME) {
    // Line/area charts also accept a CHOICE field: any category chart can
    // be flipped into a line/area look and back - the data pipeline then
    // treats it as a category chart (see compute_widget_data).
    const group_id = widget.group_by && widget.group_by.field_id;
    if (group_id && !is_time_source(catalog, group_id) && !is_categorical(catalog, group_id)) {
      errors.push(`${describe}: time charts group by submitted_at, a date field, or a choice field`);
    }
    const granularity = widget.group_by && widget.group_by.granularity;
    if (granularity && !TIME_GRANULARITIES.includes(granularity)) {
      errors.push(`${describe}: unknown time granularity`);
    }
  }
  // Over time is a way of READING a widget, not a chart type, so it is
  // checked whatever the kind: it needs a clock the records actually carry
  // and a look that has an axis to spend on a time line.
  if (widget.over_time && widget.over_time.enabled === true) {
    if (!OVER_TIME_TYPES.includes(widget.chart_type)) {
      errors.push(`${describe}: this chart type cannot be drawn over time`);
    }
    if (!is_time_source(catalog, widget.over_time.field_id)) {
      errors.push(`${describe}: over time needs submitted_at, updated_at or a date field of the form`);
    }
    if (widget.over_time.granularity && !TIME_GRANULARITIES.includes(widget.over_time.granularity)) {
      errors.push(`${describe}: unknown time granularity`);
    }
    if (widget.over_time.axis && !OVER_TIME_AXES.includes(widget.over_time.axis)) {
      errors.push(`${describe}: the time line runs along x or y`);
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

  const pattern_field = widget.pattern_by && widget.pattern_by.field_id;
  if (pattern_field) {
    const split_id = widget.split_by && widget.split_by.field_id;
    const group_id = widget.group_by && widget.group_by.field_id;
    if (!PATTERN_CHART_TYPES.includes(widget.chart_type)) {
      errors.push(`${describe}: only grouped and stacked bar or column charts take a pattern field`);
    } else if (!is_categorical(catalog, pattern_field)) {
      errors.push(`${describe}: the pattern field must be a choice field of the form`);
    } else if (pattern_field === split_id || pattern_field === group_id) {
      errors.push(`${describe}: the pattern field must differ from the group and split fields`);
    }
  }

  const legend_field = widget.legend_by && widget.legend_by.field_id;
  if (legend_field) {
    if (kind !== CHART_KINDS.KPI) {
      errors.push(`${describe}: only KPI cards take a legend field`);
    } else if (!is_categorical(catalog, legend_field)) {
      errors.push(`${describe}: the legend field must be a choice field of the form`);
    } else if (KPI_ONLY_AGGREGATIONS.includes((widget.metric || {}).aggregation)) {
      errors.push(`${describe}: ${widget.metric.aggregation} cannot be split into a legend`);
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
  if (widget.icon !== null && widget.icon !== undefined && !ICON_NAME_PATTERN.test(widget.icon)) {
    errors.push(`${describe}: icon must be a "<library>:<icon name>" reference`);
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
    const cap = widget.chart_type === "map" ? LIMITS.MAX_MAP_CATEGORIES : LIMITS.MAX_CATEGORY_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > cap) {
      errors.push(`${describe}: limit must be between 1 and ${cap}`);
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
/**
 * Where every widget sits. A widget may name a CANVAS as its parent, and
 * only a canvas: it then draws inside it instead of on the board. A parent
 * that does not exist, is not a canvas, or is the widget itself would leave
 * a widget nowhere at all; a chain of canvases that leads back to where it
 * started would leave the board drawing itself forever; and past a few
 * levels of nesting there is nothing left to see inside the innermost one.
 */
function validate_nesting(widgets, errors) {
  const by_id = new Map();
  widgets.forEach((widget) => {
    if (widget && typeof widget.id === "string") by_id.set(widget.id, widget);
  });
  widgets.forEach((widget, index) => {
    const parent_id = widget && widget.parent_id;
    if (!parent_id) return;
    const describe = `Widget ${index + 1}${widget.title ? ` (${widget.title})` : ""}`;
    if (parent_id === widget.id) {
      errors.push(`${describe}: a widget cannot sit inside itself`);
      return;
    }
    const parent = by_id.get(parent_id);
    if (!parent) {
      errors.push(`${describe}: the canvas it sits in is not on this dashboard`);
      return;
    }
    if (parent.chart_type !== "canvas") {
      errors.push(`${describe}: only a canvas can hold other widgets`);
      return;
    }
    let depth = 0;
    let cursor = parent;
    const walked = new Set([widget.id]);
    while (cursor) {
      if (walked.has(cursor.id)) {
        errors.push(`${describe}: these canvases sit inside each other`);
        return;
      }
      walked.add(cursor.id);
      depth += 1;
      if (depth > MAX_CANVAS_DEPTH) {
        errors.push(`${describe}: canvases may be nested ${MAX_CANVAS_DEPTH} deep at most`);
        return;
      }
      cursor = cursor.parent_id ? by_id.get(cursor.parent_id) : null;
    }
  });
}

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
  validate_nesting(widgets, errors);
  return { valid: errors.length === 0, errors };
}

module.exports = {
  validate_dashboard,
};
