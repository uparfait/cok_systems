const { load_form_dashboard_context } = require("../form_context.js");
const { map_shapes } = require("../map_shapes.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * The outlines a map widget draws: the shapes it has data for, the parents
 * above them and the country outline behind. A request carries the place
 * names the widget holds and the places the board is filtered to - never a
 * level, which is worked out from the names themselves and comes back in
 * the answer.
 */

function read_request(req) {
  const body = req.body || {};
  const list = (value) => (Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry.trim()) : []);
  return { names: list(body.names), parents: list(body.parents), outline: body.outline === true };
}

async function widget_map_shapes(req, res) {
  try {
    const { form_group_id } = req.params;
    if (!form_group_id) return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    const context = await load_form_dashboard_context(req.user, form_group_id);
    if (!context.found) return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    if (!context.allowed) return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    return res.status(200).json(success_response(req, "DASHBOARD_MAP_FETCHED", map_shapes(read_request(req))));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = {
  widget_map_shapes,
  read_map_request: read_request,
};
