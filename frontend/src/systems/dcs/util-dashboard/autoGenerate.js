import { classify_fields, field_label_text, fold_family, SUBMITTED_AT_FIELD } from "./chartCatalog.js";
import { save_dashboard } from "./dashboardService.js";

/**
 * The dashboard is generated fully automatically from the form itself - the
 * user never picks fields or charts. EVERY chartable field becomes its own
 * widget: a total KPI and a submissions-over-time line first, then one
 * "total" chart per choice field (donut when the options fit in six slices,
 * bars otherwise, treemap for the deepest cascade level nested under its
 * parents), then EVERY choice field categorized by EVERY other choice field
 * (district by gender, district by status, gender by status, gender by age,
 * age by gender, ... - cascading levels included, both directions kept on
 * purpose), and an average KPI per number field. The result is deliberately
 * large; each widget card carries its own remove control so the user keeps
 * only what they want.
 */

const MAX_GENERATED_WIDGETS = 150;

function option_count(field) {
  if (field.type === "select_group" && field.parent_dependency_enabled) {
    return (field.parent_option_groups || []).reduce((sum, group) => sum + ((group && group.options) || []).length, 0);
  }
  return (field.options || []).length;
}

export function is_cascade_child(field) {
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

/**
 * How one categorical field displays best: for ADDITIVE measures (count and
 * sum) the deepest cascade level becomes a treemap nested under its parents
 * and few-option fields become donuts; non-additive measures (averages,
 * extremes, spreads, distinct counts) are never part-to-whole, so they
 * always draw as plain columns.
 */
export function category_display(field, all_fields, additive) {
  if (!additive) return { chart_type: "column", limit: 12, size: "medium" };
  if (is_cascade_child(field) && !has_cascade_children(field, all_fields)) {
    return { chart_type: "treemap", limit: 50, size: "medium" };
  }
  if (option_count(field) > 0 && option_count(field) <= 6) {
    return { chart_type: "donut", limit: 6, size: "small" };
  }
  return { chart_type: "bar", limit: 12, size: "medium" };
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
      description: "",
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

  // EVERY choice field of the form gets a chart: the deepest cascade levels
  // (a child with no children of its own) become treemaps nested under
  // their parents; plain choice fields become donuts when they fit in six
  // slices and bars otherwise.
  fields.categorical.forEach((field) => {
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

  // EVERY choice field categorized by EVERY other one - the full pairwise
  // comparison matrix, cascading levels included and both directions kept
  // (district by gender AND gender by district read differently). The cap
  // only guards against pathological forms with dozens of choice fields.
  fields.categorical.forEach((group_field) => {
    fields.categorical.forEach((split_field) => {
      if (group_field.id === split_field.id || widgets.length >= MAX_GENERATED_WIDGETS) return;
      widgets.push(
        make({
          title: translate("DCS_DB_GEN_VS", { a: field_label_text(group_field), b: field_label_text(split_field) }),
          chart_type: "stacked_column",
          group_by: { field_id: group_field.id },
          split_by: { field_id: split_field.id },
          size: "large",
        }),
      );
    });
  });

  // EVERY number field gets its average as a KPI.
  fields.numeric.forEach((field) => {
    if (widgets.length >= MAX_GENERATED_WIDGETS) return;
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

const wait = (duration_ms) => new Promise((resolve) => setTimeout(resolve, duration_ms));

/**
 * Generates the form's dashboard end to end, reporting progress through
 * on_stage(percent, message_key): analyze the schema, build the widgets,
 * save them as the form's dashboard. Returns the saved widget list; throws
 * an Error whose message is a TRANSLATION KEY when the form has nothing
 * chartable.
 */
export async function generate_and_save(form, translate, on_stage) {
  const result = await regenerate_and_save(form, translate, "overwrite", [], on_stage);
  return result.widgets;
}

/**
 * What a widget CHARTS, independent of its look and wording: two widgets
 * with equal identities show the same data even as a bar versus a column or
 * with different titles. This is what "already available" means when a
 * regeneration updates instead of overwriting.
 */
export function widget_identity(widget) {
  return JSON.stringify([
    fold_family(widget.chart_type),
    (widget.metric && widget.metric.aggregation) || "count",
    (widget.metric && widget.metric.field_id) || null,
    (widget.group_by && widget.group_by.field_id) || null,
    (widget.split_by && widget.split_by.field_id) || null,
    widget.x_field_id || null,
    widget.y_field_id || null,
    widget.size_field_id || null,
  ]);
}

/**
 * Regenerates the form's dashboard in one of two modes: "overwrite" replaces
 * the whole board with a fresh generation, while "update" generates and adds
 * ONLY the widgets whose data is not charted yet - every widget already on
 * the board (including ones the user retitled or converted to another look
 * of the same data) is skipped and kept untouched. Returns { widgets, added }.
 */
export async function regenerate_and_save(form, translate, mode, existing_widgets, on_stage) {
  on_stage(15, "DCS_DB_GEN_PROGRESS_ANALYZE");
  await wait(400);
  const generated = generate_form_widgets(form, translate);
  if (generated.length === 0) {
    const empty_error = new Error("DCS_DB_NOTHING_TO_GENERATE");
    empty_error.is_translation_key = true;
    throw empty_error;
  }
  on_stage(55, "DCS_DB_GEN_PROGRESS_BUILD");
  await wait(400);
  let next_widgets = generated;
  let added = generated.length;
  if (mode === "update") {
    const existing = existing_widgets || [];
    const known = new Set(existing.map(widget_identity));
    const fresh = generated.filter((widget) => !known.has(widget_identity(widget)));
    added = fresh.length;
    next_widgets = existing.concat(fresh).slice(0, MAX_GENERATED_WIDGETS);
  }
  next_widgets = next_widgets.map((widget, index) => ({ ...widget, position: index }));
  on_stage(85, "DCS_DB_GEN_PROGRESS_SAVE");
  const saved = await save_dashboard(form.form_group_id, next_widgets);
  on_stage(100, "DCS_DB_GEN_DONE");
  await wait(350);
  return { widgets: (saved.data && saved.data.widgets) || next_widgets, added };
}
