const { resolve_navigation_cached } = require("./navigation.js");

/**
 * Role-based access for this service. The caller's role (read by
 * authenticate from the main system's users collection) is resolved to its
 * navigation locally (utilities/navigation.js, same catalog and roles
 * collection the main backend uses). A user may use DCS only when that
 * navigation carries the "dcs" link - exactly when the sidebar shows it.
 */

const FORBIDDEN_MESSAGE = "BC::: YOU ARE NOT ALLOWED TO USE THIS RESOURCE";
const DCS_LINK_ID = "dcs";

function forbidden_body(detail) {
  return {
    success: false,
    type: "warning",
    forbidden_resource: true,
    goto_login: true,
    message: FORBIDDEN_MESSAGE,
    error: detail || "Your role does not grant access to the Data Collection System",
  };
}

/** The navigation of an authenticated request's user. */
async function navigation_for_user(user) {
  return resolve_navigation_cached(user ? user.role : "");
}

function has_link(nav, link_id) {
  return !!nav && (nav.links || []).some((link) => link && link.id === link_id);
}

module.exports = {
  FORBIDDEN_MESSAGE,
  DCS_LINK_ID,
  forbidden_body,
  navigation_for_user,
  has_link,
};
