const values_model = require("../../models/submission_values_model.js");
const project_access = require("../../utilities/project_access.js");
const { resolve_period_bounds } = require("../../utilities/period_bounds.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * The values one column has actually collected, each with its record
 * count - what the data table's per-column filter dropdown offers. Scoped
 * to the same date range the table is currently showing, so the dropdown
 * never offers a value the visible range has none of.
 */
async function get_field_values(req, res) {
  try {
    const { form_group_id, field_id } = req.params;
    const { period = "all", from, to } = req.query || {};

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

    const values = await values_model.list_field_values(form_group_id, field_id, bounds);
    return res.status(200).json(success_response(req, "SUBMISSIONS_FETCHED", { field_id, values }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = get_field_values;
