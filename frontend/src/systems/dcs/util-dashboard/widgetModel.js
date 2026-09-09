import { chart_definition, classify_fields, SUBMITTED_AT_FIELD } from "./chartCatalog.js";

/**
 * Client-side widget helpers: a fresh draft, and the readiness check the
 * wizard uses to decide whether a draft can be previewed and added. The
 * backend re-validates everything on save, so this only guides the UI.
 */

export function new_widget(form_group_id) {
  return {
    id: `w_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    title: "",
    form_group_id: form_group_id || "",
    chart_type: "",
    metric: { aggregation: "count", field_id: null },
    group_by: null,
    split_by: null,
    x_field_id: null,
    y_field_id: null,
    size_field_id: null,
    filters: [],
    period: { preset: "all", from: null, to: null },
    sort: "value_desc",
    limit: 12,
    size: "medium",
    position: 0,
  };
}

/**
 * The reasons a draft cannot be finished yet, as translation keys - shown
 * next to the wizard's Next/Finish buttons.
 */
export function widget_problems(widget, form) {
  const problems = [];
  const definition = chart_definition(widget.chart_type);
  if (!definition) return ["DCS_DB_PROBLEM_CHART"];
  if (!widget.form_group_id || !form) return ["DCS_DB_PROBLEM_FORM"];

  const fields = classify_fields(form.schema);
  const categorical_ids = fields.categorical.map((field) => field.id);
  const numeric_ids = fields.numeric.map((field) => field.id);
  const date_ids = fields.dates.map((field) => field.id);

  if (widget.metric.aggregation !== "count" && !numeric_ids.includes(widget.metric.field_id)) {
    problems.push("DCS_DB_PROBLEM_METRIC");
  }
  if (definition.kind === "category" || definition.kind === "tree") {
    if (!widget.group_by || !categorical_ids.includes(widget.group_by.field_id)) {
      problems.push("DCS_DB_PROBLEM_GROUP");
    }
  }
  if (definition.kind === "time") {
    const source = widget.group_by && widget.group_by.field_id;
    if (source !== SUBMITTED_AT_FIELD && !date_ids.includes(source)) {
      problems.push("DCS_DB_PROBLEM_TIME");
    }
  }
  if (definition.kind === "point") {
    if (!numeric_ids.includes(widget.x_field_id) || !numeric_ids.includes(widget.y_field_id)) {
      problems.push("DCS_DB_PROBLEM_AXES");
    }
    if (widget.chart_type === "bubble" && !numeric_ids.includes(widget.size_field_id)) {
      problems.push("DCS_DB_PROBLEM_SIZE_FIELD");
    }
  }
  if (definition.split === "required") {
    const split = widget.split_by && widget.split_by.field_id;
    if (!split || !categorical_ids.includes(split)) problems.push("DCS_DB_PROBLEM_SPLIT");
    else if (widget.group_by && split === widget.group_by.field_id) problems.push("DCS_DB_PROBLEM_SPLIT_SAME");
  }
  return problems;
}

export function widget_needs_title(widget) {
  return !widget.title || !widget.title.trim();
}

/**
 * Grid column span of a widget size on the 4-column dashboard grid.
 */
export function size_span(size) {
  return { small: 1, medium: 2, large: 3, full: 4 }[size] || 2;
}

export function next_size(size) {
  const order = ["small", "medium", "large", "full"];
  return order[(order.indexOf(size) + 1) % order.length];
}
