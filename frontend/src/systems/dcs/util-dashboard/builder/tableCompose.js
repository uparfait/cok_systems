import { SUBMITTED_AT_FIELD } from "../chartCatalog.js";
import { behavior_spec, with_behavior, period_problem } from "./widgetBehavior.js";

/**
 * The pure side of the Table tab: the empty spec, the formulas a column
 * may take, what stops a table being built, its default title, and the
 * widget document it becomes - and the reverse, for reopening one.
 *
 * A RECORDS table shows the submissions themselves: the fields the author
 * ticked, ten to a hundred rows a page. A SUMMARY table has one row per
 * value of the group field and takes its columns either from the values
 * of a split field (each cell the one formula) or from MEASURES the author
 * lists one by one - each its own formula on its own field, under an
 * optional filter of its own - with a total row and a total column.
 */

export const TABLE_MODES = ["records", "summary"];
export const COLUMN_SOURCES = ["split", "measures"];
export const PAGE_SIZE_MIN = 10;
export const PAGE_SIZE_MAX = 100;
export const MAX_FIELDS = 30;
export const MAX_COLUMNS = 30;
export const ROW_LIMIT_MAX = 50;

// The formulas a cell may compute: the groupable ones (median, running and
// moving figures exist only on KPI cards; occurrences draw their own rows).
export const COLUMN_FORMULAS = ["count", "count_distinct", "sum", "avg", "min", "max", "stddev"];
export const FIELD_FORMULAS = ["count_distinct", "sum", "avg", "min", "max", "stddev"];
export const COLUMN_OPERATORS = ["eq", "ne", "contains", "gt", "gte", "lt", "lte", "empty", "not_empty"];
const VALUELESS = ["empty", "not_empty"];

let column_sequence = 0;
export function new_column() {
  column_sequence += 1;
  return { key: `c_${Date.now().toString(36)}_${column_sequence}`, label: "", aggregation: "count", field_id: "", filter_field: "", filter_operator: "eq", filter_value: "" };
}

export const EMPTY_TABLE_SPEC = {
  mode: "records",
  fields: [],
  page_size: 10,
  sort_field: SUBMITTED_AT_FIELD,
  sort_dir: "desc",
  show_submitted_at: true,
  group_id: "",
  columns_from: "measures",
  split_id: "",
  aggregation: "count",
  field_id: "",
  columns: [],
  totals_row: true,
  totals_column: false,
  row_limit: 12,
  sort: "value_desc",
  title: "",
  title_touched: false,
  description: "",
  size: "large",
  appearance: null,
  period: null,
  pinned_fields: [],
  // The fixed conditions a reopened table carried; a new one has none.
  filters: [],
};

const field_of = (fields, id) => (fields || []).find((field) => field.id === id) || null;

/** Why a table cannot be added yet, first reason first. */
export function table_spec_problems(spec, fields, translate) {
  const problems = [];
  if (spec.mode === "records") {
    if (!Array.isArray(spec.fields) || spec.fields.length === 0) problems.push(translate("DCS_DB_TABLE_NEED_FIELDS"));
  } else {
    const group = field_of(fields, spec.group_id);
    if (!group || !group.is_choice) problems.push(translate("DCS_DB_TABLE_NEED_GROUP"));
    if (spec.columns_from === "split") {
      const split = field_of(fields, spec.split_id);
      if (!split || !split.is_choice || split.id === spec.group_id) problems.push(translate("DCS_DB_TABLE_NEED_SPLIT"));
      if (FIELD_FORMULAS.includes(spec.aggregation) && !field_of(fields, spec.field_id)) problems.push(translate("DCS_DB_NEED_MEASURE_FIELD"));
    } else {
      if (!Array.isArray(spec.columns) || spec.columns.length === 0) problems.push(translate("DCS_DB_TABLE_NEED_COLUMNS"));
      (spec.columns || []).forEach((column, index) => {
        if (FIELD_FORMULAS.includes(column.aggregation) && !field_of(fields, column.field_id)) problems.push(translate("DCS_DB_TABLE_COLUMN_NEED_FIELD", { n: index + 1 }));
        if (column.filter_field && !VALUELESS.includes(column.filter_operator) && String(column.filter_value || "").trim() === "") problems.push(translate("DCS_DB_TABLE_COLUMN_NEED_FILTER_VALUE", { n: index + 1 }));
        // The server compares numbers only under these operators.
        if (column.filter_field && ["gt", "gte", "lt", "lte"].includes(column.filter_operator) && !Number.isFinite(Number(column.filter_value))) problems.push(translate("DCS_DB_TABLE_COLUMN_NEED_NUMBER", { n: index + 1 }));
      });
    }
  }
  if (!String(spec.title || "").trim()) problems.push(translate("DCS_DB_NEED_TITLE"));
  if (period_problem(spec.period, translate)) problems.push(period_problem(spec.period, translate));
  return problems;
}

/** A readable default title, from what the table shows. */
export function default_table_title(spec, fields, translate, formula_label) {
  if (spec.mode === "records") return translate("DCS_DB_TABLE_DEFAULT_TITLE_RECORDS");
  const group = field_of(fields, spec.group_id);
  if (!group) return "";
  const measure = spec.columns_from === "split" ? `${formula_label(spec.aggregation)}${field_of(fields, spec.field_id) ? ` ${field_of(fields, spec.field_id).label}` : ""}` : translate("DCS_DB_TABLE_COLUMNS_MEASURES");
  return translate("DCS_DB_TABLE_DEFAULT_TITLE_SUMMARY", { measure, field: group.label });
}

/** One measure column as the widget stores it. */
function column_document(column, fields) {
  const out = { key: column.key, label: String(column.label || "").trim().slice(0, 120), aggregation: column.aggregation || "count", field_id: FIELD_FORMULAS.includes(column.aggregation) || column.aggregation === "count" ? column.field_id || null : null, filters: [] };
  if (column.filter_field && field_of(fields, column.filter_field)) {
    const valueless = VALUELESS.includes(column.filter_operator);
    out.filters.push({ field_id: column.filter_field, operator: column.filter_operator || "eq", value: valueless ? "" : column.filter_value });
  }
  if (!out.label) {
    const field = field_of(fields, out.field_id);
    out.label = field ? field.label : out.aggregation;
  }
  return out;
}

let sequence = 0;

/** The widget document of one table. */
export function build_table_draft(form, spec, fields) {
  sequence += 1;
  const records = spec.mode === "records";
  const table = records
    ? {
        mode: "records",
        fields: (spec.fields || []).slice(0, MAX_FIELDS),
        page_size: Math.min(PAGE_SIZE_MAX, Math.max(PAGE_SIZE_MIN, Math.round(Number(spec.page_size) || PAGE_SIZE_MIN))),
        sort: { field_id: spec.sort_field || SUBMITTED_AT_FIELD, direction: spec.sort_dir === "asc" ? "asc" : "desc" },
        show_submitted_at: spec.show_submitted_at !== false,
      }
    : {
        mode: "summary",
        columns: spec.columns_from === "split" ? [] : (spec.columns || []).slice(0, MAX_COLUMNS).map((column) => column_document(column, fields)),
        totals: { row: spec.totals_row !== false, column: spec.totals_column === true },
      };
  const split = !records && spec.columns_from === "split";
  const widget = {
    id: `tb_${form.form_group_id}_${Date.now()}_${sequence}`,
    form_group_id: form.form_group_id,
    title: String(spec.title || "").trim().slice(0, 120),
    description: String(spec.description || "").trim(),
    icon: null,
    chart_type: "table",
    metric: split ? { aggregation: spec.aggregation || "count", field_id: FIELD_FORMULAS.includes(spec.aggregation) ? spec.field_id || null : null } : { aggregation: "count", field_id: null },
    group_by: records ? null : { field_id: spec.group_id },
    split_by: split ? { field_id: spec.split_id } : null,
    pattern_by: null,
    legend_by: null,
    appearance: spec.appearance || null,
    table,
    x_field_id: null,
    y_field_id: null,
    size_field_id: null,
    filters: Array.isArray(spec.filters) ? spec.filters : [],
    period: { preset: "all", from: null, to: null },
    sort: records ? "value_desc" : spec.sort || "value_desc",
    limit: records ? 12 : Math.min(ROW_LIMIT_MAX, Math.max(1, Math.round(Number(spec.row_limit) || 12))),
    size: ["small", "medium", "large"].includes(spec.size) ? spec.size : "large",
    position: 0,
  };
  return with_behavior([widget], spec);
}

/** A saved table read back into the composer. */
export function table_widget_to_spec(widget) {
  const table = (widget && widget.table) || {};
  const records = table.mode !== "summary";
  const columns = (table.columns || []).map((column) => {
    const filter = (column.filters || [])[0] || null;
    return { key: column.key || new_column().key, label: column.label || "", aggregation: column.aggregation || "count", field_id: column.field_id || "", filter_field: filter ? filter.field_id : "", filter_operator: filter ? filter.operator : "eq", filter_value: filter && filter.value !== undefined && filter.value !== null ? String(filter.value) : "" };
  });
  return {
    ...EMPTY_TABLE_SPEC,
    mode: records ? "records" : "summary",
    fields: Array.isArray(table.fields) ? table.fields.slice() : [],
    page_size: Number(table.page_size) || 10,
    sort_field: (table.sort && table.sort.field_id) || SUBMITTED_AT_FIELD,
    sort_dir: table.sort && table.sort.direction === "asc" ? "asc" : "desc",
    show_submitted_at: table.show_submitted_at !== false,
    group_id: (widget.group_by && widget.group_by.field_id) || "",
    columns_from: widget.split_by && widget.split_by.field_id ? "split" : "measures",
    split_id: (widget.split_by && widget.split_by.field_id) || "",
    aggregation: (widget.metric && widget.metric.aggregation) || "count",
    field_id: (widget.metric && widget.metric.field_id) || "",
    columns,
    totals_row: !table.totals || table.totals.row !== false,
    totals_column: !!(table.totals && table.totals.column === true),
    row_limit: Number(widget.limit) || 12,
    sort: widget.sort || "value_desc",
    title: widget.title || "",
    title_touched: true,
    description: widget.description || "",
    size: widget.size || "large",
    appearance: widget.appearance || null,
    filters: Array.isArray(widget.filters) ? widget.filters.map((filter) => ({ ...filter })) : [],
    ...behavior_spec(widget),
  };
}
