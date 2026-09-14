const { navigation_for_user, has_link, forbidden_body, DCS_LINK_ID } = require("../utilities/access_control.js");
const { error_response } = require("../utilities/response.js");

/**
 * Runs after authenticate: the caller may use the Data Collection System
 * only when their role's navigation carries the DCS link. Anything else is
 * refused with the shared "BC:::" body, which the frontend turns into a
 * forced logout. Resolution is entirely local (catalog file + the roles
 * collection of the shared cok database).
 */
async function authorize_dcs(req, res, next) {
  try {
    const nav = await navigation_for_user(req.user);
    req.navigation = nav;
    if (has_link(nav, DCS_LINK_ID)) return next();

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
