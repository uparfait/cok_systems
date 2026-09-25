const values_model = require("../../models/submission_values_model.js");
const forms_model = require("../../models/forms_model.js");
const project_access = require("../../utilities/project_access.js");
const { flatten_fields } = require("../../jsonlogic/dependency_graph.js");
const { resolve_period_bounds } = require("../../utilities/period_bounds.js");
const { is_enabled: is_tracking_enabled } = require("../../utilities/tracking.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/** The picked parent values, sent as a JSON list; anything else means no parent narrowing. */
function parse_parent_values(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.filter((value) => value !== null && value !== undefined && value !== "") : [];
  } catch (error) {
    return [];
  }
}

/**
 * The values the field's own definition offers, so a choice nobody has
 * picked yet is still listed (with a count of 0). A cascading select's
 * options belong to a parent answer each; a select split into parent
 * groups keeps the options of the groups whose parent value was picked.
 * Answers fetched from the locations API have no fixed list and add
 * nothing here.
 */
function schema_option_values(field, parent_values) {
  if (!field) return [];
  const wanted = new Set((parent_values || []).map((value) => String(value)));
  const narrow = wanted.size > 0;
  const out = [];
  const push = (value) => {
    if (value === undefined || value === null || String(value).trim() === "") return;
    if (!out.some((entry) => String(entry) === String(value))) out.push(value);
  };
  if (field.type === "cascading_select") {
    (field.options || []).forEach((option) => {
      if (!narrow || wanted.has(String(option.parent_value))) push(option.value);
    });
    return out;
  }
  if (field.parent_dependency_enabled && Array.isArray(field.parent_option_groups)) {
    field.parent_option_groups.forEach((group) => {
      if (narrow && !wanted.has(String(group.value))) return;
      (group.options || []).forEach((option) => push(option.value));
    });
    return out;
  }
  (field.options || []).forEach((option) => push(option.value));
  return out;
}

/**
 * The values one column offers to filter by: what the records actually
 * hold (each with its count), under the same date range the table shows
 * and, for a cascade child, only under the parent values picked above it -
 * plus every option the field defines that has no record yet, at 0, so
 * the list always reads the same and an empty choice is still visible.
 */
async function get_field_values(req, res) {
  try {
    const { form_group_id, field_id } = req.params;
    const { period = "all", from, to, parent_field_id, parent_values } = req.query || {};

    if (!form_group_id || !field_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const access = await project_access.can_view_form_group(req.user, form_group_id);
    if (!access.found) return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    if (!access.allowed) return res.status(403).json(warning_response(req, "ACCESS_DENIED"));

    const bounds = resolve_period_bounds(period, from, to);
    if (bounds === undefined) {
      return res.status(400).json(warning_response(req, "VALIDATION_FAILED"));
    }

    const picked_parent = parse_parent_values(parent_values);
    const parent = parent_field_id && picked_parent.length > 0 ? { field_id: String(parent_field_id), values: picked_parent } : null;

    const active_version = await forms_model.get_active_version(form_group_id);
    const field = active_version ? flatten_fields((active_version.schema && active_version.schema.fields) || []).find((entry) => entry.id === field_id) : null;
    // A tracked form's values are read as they stood at the range's end,
    // over the records the range keeps - exactly what the table shows. The
    // same gate the table uses (is_tracking_enabled, which also wants a key
    // field), so the two can never read one range two ways.
    const tracking = active_version && is_tracking_enabled(active_version.tracking) ? active_version.tracking : null;

    const collected = await values_model.list_field_values(form_group_id, field_id, bounds, parent, tracking);
    const seen = new Set(collected.map((entry) => String(entry.value)));
    const empty_options = schema_option_values(field, parent ? parent.values : []).filter((value) => !seen.has(String(value))).map((value) => ({ value, count: 0 }));

    return res.status(200).json(success_response(req, "SUBMISSIONS_FETCHED", { field_id, values: collected.concat(empty_options) }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_field_values;
