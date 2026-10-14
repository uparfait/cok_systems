const { load_form_dashboard_context } = require("../form_context.js");
const { compute_dashboard_results } = require("../compute_results.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * Computes the live data of the requested widgets of ONE form in a single
 * round trip - used by the dashboard view. Every aggregation runs as a
 * native MongoDB pipeline over everything the form holds (generated test
 * data included, same as the submissions chart), and every widget is pinned
 * to this form no matter what the payload claims. A broken widget comes
 * back as a per-widget error so one bad chart never takes the whole
 * dashboard down. The computation itself lives in compute_results.js,
 * shared with the public share-link endpoint.
 */
async function dashboard_data(req, res) {
  try {
    const { form_group_id } = req.params;

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const context = await load_form_dashboard_context(req.user, form_group_id);
    if (!context.found) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }
    if (!context.allowed) {
      return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    }

    const results = await compute_dashboard_results(req.body || {}, form_group_id, context.form_version, context.project._id);
    return res.status(200).json(success_response(req, "DASHBOARD_DATA_FETCHED", { results }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = dashboard_data;
