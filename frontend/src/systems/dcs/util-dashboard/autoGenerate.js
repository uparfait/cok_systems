import { classify_fields, field_label_text, SUBMITTED_AT_FIELD } from "./chartCatalog.js";

/**
 * Builds a sensible ready-made dashboard for one form, straight from its
 * schema: a total KPI, a submissions-over-time line, one chart per choice
 * field (donut when the options fit in six slices, bars otherwise, treemap
 * for the deepest cascade level), an average KPI per number field, and a
 * stacked comparison of the two main choice fields. The result is a plain
 * widget list - saved through the same endpoint the manual builder uses,
 * so everything stays editable afterwards.
 */

const MAX_CATEGORY_WIDGETS = 8;
const MAX_NUMERIC_WIDGETS = 3;

function option_count(field) {
  if (field.type === "select_group" && field.parent_dependency_enabled) {
    return (field.parent_option_groups || []).reduce((sum, group) => sum + ((group && group.options) || []).length, 0);
  }
  return (field.options || []).length;
}

function is_cascade_child(field) {
  if (field.parent_field_id) return true;
  if (field.type === "select_group" && field.parent_dependency_enabled) {
    return (field.parent_option_groups || []).some((group) => group && group.parent_field_id);
  }
  return false;
}

function has_cascade_children(field, all_fields) {
  return all_fields.some(
    (other) =>
      other.parent_field_id === field.id ||
      (other.type === "select_group" &&
        other.parent_dependency_enabled &&
        (other.parent_option_groups || []).some((group) => group && group.parent_field_id === field.id)),
  );
}

export function generate_form_widgets(form, translate) {
  const fields = classify_fields(form.schema);
  const widgets = [];
  let sequence = 0;
  const make = (extra) => {
    sequence += 1;
    return {
      id: `gen_${form.form_group_id}_${Date.now()}_${sequence}`,
      form_group_id: form.form_group_id,
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
      position: widgets.length,
      ...extra,
    };
  };

  widgets.push(
    make({ title: translate("DCS_DB_GEN_TOTAL"), chart_type: "kpi", size: "small" }),
    make({
      title: translate("DCS_DB_GEN_OVER_TIME"),
      chart_type: "line",
      group_by: { field_id: SUBMITTED_AT_FIELD, granularity: "auto" },
      size: "large",
    }),
  );

  // Deepest cascade levels (a child with no children of its own) become
  // treemaps nested under their parents; plain choice fields become donuts
  // when they fit in six slices and bars otherwise.
  fields.categorical.slice(0, MAX_CATEGORY_WIDGETS).forEach((field) => {
    const label = field_label_text(field);
    const child = is_cascade_child(field);
    const parent_of_more = has_cascade_children(field, fields.all);
    let chart_type = "bar";
    let limit = 12;
    let size = "medium";
    if (child && !parent_of_more) {
      chart_type = "treemap";
      limit = 50;
    } else if (option_count(field) > 0 && option_count(field) <= 6) {
      chart_type = "donut";
      limit = 6;
      size = "small";
    }
    widgets.push(make({ title: translate("DCS_DB_GEN_BY", { label }), chart_type, group_by: { field_id: field.id }, limit, size }));
  });

  // The two main non-cascading choice fields compared against each other.
  const plain = fields.categorical.filter((field) => !is_cascade_child(field) && !has_cascade_children(field, fields.all));
  if (plain.length >= 2) {
    widgets.push(
      make({
        title: translate("DCS_DB_GEN_VS", { a: field_label_text(plain[0]), b: field_label_text(plain[1]) }),
        chart_type: "stacked_column",
        group_by: { field_id: plain[0].id },
        split_by: { field_id: plain[1].id },
        size: "large",
      }),
    );
  }

  fields.numeric.slice(0, MAX_NUMERIC_WIDGETS).forEach((field) => {
    widgets.push(
      make({
        title: translate("DCS_DB_GEN_AVG", { label: field_label_text(field) }),
        chart_type: "kpi",
        metric: { aggregation: "avg", field_id: field.id },
        size: "small",
      }),
    );
  });

  return widgets;
}
