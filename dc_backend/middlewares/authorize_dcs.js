const { fetch_navigation, has_link, forbidden_body, DCS_LINK_ID } = require("../utilities/access_control.js");
const { warning_response, error_response } = require("../utilities/response.js");

/**
 * Runs after authenticate: the caller may use the Data Collection System
 * only when their role's navigation carries the DCS link. Anything else is
 * refused with the shared "BC:::" body, which the frontend turns into a
 * forced logout.
 */
async function authorize_dcs(req, res, next) {
  try {
    const result = await fetch_navigation(req.headers.authorization);
    if (!result.ok) {
      if (result.status === 401) {
        return res.status(401).json(warning_response(req, "AUTH_TOKEN_INVALID", null, { goto_login: true }));
      }
      return res.status(503).json(error_response(req, "ACCESS_CHECK_UNAVAILABLE", null, "main backend unreachable"));
    }
    req.navigation = result.nav;
    if (has_link(result.nav, DCS_LINK_ID)) return next();

    console.warn(`[RBAC] ${req.user ? req.user.email : "unknown"} (${req.user ? req.user.role : "no role"}) denied ${req.method} ${req.originalUrl}`);
    return res.status(403).json(forbidden_body(`${req.method} ${req.originalUrl} requires the DCS system`));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

/**
 * Skips a middleware for a few exact router-relative paths - used so an
 * approver's own dashboard stays reachable without the DCS link.
 */
function except(paths, middleware) {
  return (req, res, next) => (paths.includes(req.path) ? next() : middleware(req, res, next));
}

module.exports = { authorize_dcs, except };
