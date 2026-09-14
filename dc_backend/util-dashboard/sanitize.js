/**
 * Reduces incoming widget payloads to exactly the keys the dashboard
 * understands - anything else a client sends is dropped before validation
 * and storage, so no stray data can ever be persisted or executed.
 */

function clean_string(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitize_field_ref(value) {
  if (!value || typeof value !== "object" || typeof value.field_id !== "string" || !value.field_id.trim()) return null;
  return { field_id: value.field_id.trim() };
}

function sanitize_widget(widget) {
  if (!widget || typeof widget !== "object") return null;
  const group_by = sanitize_field_ref(widget.group_by);
  if (group_by && widget.group_by && typeof widget.group_by.granularity === "string") {
    group_by.granularity = widget.group_by.granularity;
  }
  const period =
    widget.period && typeof widget.period === "object"
      ? {
          preset: clean_string(widget.period.preset),
          from: clean_string(widget.period.from) || null,
          to: clean_string(widget.period.to) || null,
        }
      : null;
  return {
    id: clean_string(widget.id),
    title: clean_string(widget.title),
    description: clean_string(widget.description) || null,
    // A KPI card's optional Tabler icon, stored by its component name.
    icon: clean_string(widget.icon) || null,
    form_group_id: clean_string(widget.form_group_id),
    chart_type: clean_string(widget.chart_type),
    metric: {
      aggregation: clean_string(widget.metric && widget.metric.aggregation) || "count",
      field_id: clean_string(widget.metric && widget.metric.field_id) || null,
    },
    group_by,
    split_by: sanitize_field_ref(widget.split_by),
    x_field_id: clean_string(widget.x_field_id) || null,
    y_field_id: clean_string(widget.y_field_id) || null,
    size_field_id: clean_string(widget.size_field_id) || null,
    filters: Array.isArray(widget.filters)
      ? widget.filters
          .filter((filter) => filter && typeof filter === "object")
          .map((filter) => ({
            field_id: clean_string(filter.field_id),
            operator: clean_string(filter.operator),
            value: ["string", "number", "boolean"].includes(typeof filter.value) ? filter.value : "",
          }))
      : [],
    period: period && period.preset ? period : null,
    sort: widget.sort === undefined ? undefined : clean_string(widget.sort),
    limit: widget.limit === undefined ? undefined : Number(widget.limit),
    size: widget.size === undefined ? undefined : clean_string(widget.size),
    position: Number.isInteger(widget.position) ? widget.position : 0,
  };
}

function sanitize_widgets(widgets) {
  if (!Array.isArray(widgets)) return [];
  return widgets.map((widget) => sanitize_widget(widget)).filter((widget) => widget !== null);
}

/**
 * The dashboard-level period override of a data request.
 */
function sanitize_period_override(period) {
  if (!period || typeof period !== "object" || !clean_string(period.preset)) return null;
  return {
    preset: clean_string(period.preset),
    from: clean_string(period.from) || null,
    to: clean_string(period.to) || null,
  };
}

module.exports = {
  sanitize_widget,
  sanitize_widgets,
  sanitize_period_override,
};
