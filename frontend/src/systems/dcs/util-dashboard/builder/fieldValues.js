import { get_dashboard_data } from "../dashboardService.js";
import { field_option_values } from "../kpiCatalog.js";

const OTHER_KEY = "__other__";

/**
 * Every value of one field to fan KPI cards out over: the values ACTUALLY
 * PRESENT in the collected data (read through the category pipeline, folded
 * tail included) unioned with the schema's own options - so API-sourced
 * cascadings and likert scales, which define no inline options, still get
 * one card per real value. A probe failure falls back to the schema options.
 */
export async function resolve_fan_out_values(form, field) {
  const known = field_option_values(field.raw || field);
  try {
    const probe = {
      id: `probe_${field.id}`,
      title: "probe",
      form_group_id: form.form_group_id,
      chart_type: "bar",
      metric: { aggregation: "count", field_id: null },
      group_by: { field_id: field.id },
      split_by: null,
      x_field_id: null,
      y_field_id: null,
      size_field_id: null,
      filters: [],
      period: { preset: "all", from: null, to: null },
      sort: "label_asc",
      limit: 50,
      size: "medium",
      position: 0,
    };
    const response = await get_dashboard_data(form.form_group_id, [probe], null);
    const result = ((response.data && response.data.results) || [])[0] || {};
    if (result.error) return known;
    const values = (result.rows || [])
      .concat(result.other_rows || [])
      .map((row) => row.label)
      .filter((label) => label !== undefined && label !== null && String(label).trim().length > 0 && label !== OTHER_KEY);
    known.forEach((value) => {
      if (!values.some((existing) => String(existing) === String(value))) values.push(value);
    });
    return values;
  } catch (probe_error) {
    void probe_error;
    return known;
  }
}
