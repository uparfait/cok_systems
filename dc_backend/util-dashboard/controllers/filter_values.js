const { load_form_dashboard_context } = require("../form_context.js");
const { compute_filter_values } = require("../compute_results.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * The values one board filter can take right now (see compute_filter_values):
 * the distinct answers of that field across the form's records, inside the
 * requested period and under the other applied filters. Anyone allowed to
 * see the form's data may ask.
 */
async function filter_values(req, res) {
  try {
    const { form_group_id } = req.params;
    if (!form_group_id) return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    const context = await load_form_dashboard_context(req.user, form_group_id);
    if (!context.found) return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    if (!context.allowed) return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    const result = await compute_filter_values(req.body || {}, form_group_id, context.form_version);
    if (result.invalid) return res.status(400).json(warning_response(req, "DASHBOARD_FILTER_INVALID"));
    return res.status(200).json(success_response(req, "DASHBOARD_FILTER_VALUES_FETCHED", { values: result.values }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = filter_values;
