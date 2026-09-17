const { load_form_dashboard_context } = require("../form_context.js");
const { map_shapes, MAP_LEVELS } = require("../map_shapes.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

/**
 * The outlines a map widget draws: the shapes it names at its own level
 * (districts, sectors, cells, villages), the parents above them and the
 * country outline behind. The widget sends the names it has data for, never
 * the whole country, and every one of them is found by walking down the
 * administrative tree, so a shape comes back knowing the chain above it.
 *
 * A request may also send "within": { province, district, sector, cell } to
 * keep that walk inside one branch, which is how a name that repeats across
 * the country is pinned down to one place.
 */

function read_request(req, res) {
  const body = req.body || {};
  const level = typeof body.level === "string" ? body.level.trim() : "";
  if (!MAP_LEVELS.includes(level)) {
    res.status(400).json(warning_response(req, "DASHBOARD_MAP_LEVEL_INVALID"));
    return null;
  }
  const within = body.within && typeof body.within === "object" ? body.within : {};
  return { level, names: Array.isArray(body.names) ? body.names : [], outline: body.outline === true, within };
}

async function widget_map_shapes(req, res) {
  try {
    const { form_group_id } = req.params;
    if (!form_group_id) return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    const context = await load_form_dashboard_context(req.user, form_group_id);
    if (!context.found) return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    if (!context.allowed) return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    const request = read_request(req, res);
    if (!request) return undefined;
    return res.status(200).json(success_response(req, "DASHBOARD_MAP_FETCHED", map_shapes(request.level, request.names, request.outline, request.within)));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = {
  widget_map_shapes,
  read_map_request: read_request,
};
