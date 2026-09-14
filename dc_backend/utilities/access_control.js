const config = require("../configurations/config.js");

/**
 * Role-based access for this service. The main backend is the single
 * source of truth for "which systems may this role use": it resolves a
 * role's navigation (sidebar links) from Default_Roles.json and the roles
 * collection. Instead of duplicating that logic here, the caller's own
 * bearer token is forwarded to GET /roles/navigation and the answer is
 * kept for a short while per token. A user may use DCS only when that
 * navigation carries the "dcs" link - exactly when the sidebar shows it.
 */

const FORBIDDEN_MESSAGE = "BC::: YOU ARE NOT ALLOWED TO USE THIS RESOURCE";
const DCS_LINK_ID = "dcs";
const NAV_CACHE_TTL_MS = 60 * 1000;
const NAV_CACHE_MAX_ENTRIES = 5000;

const nav_cache = new Map();

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

function prune_cache() {
  if (nav_cache.size < NAV_CACHE_MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of nav_cache) {
    if (entry.expires <= now) nav_cache.delete(key);
  }
  if (nav_cache.size >= NAV_CACHE_MAX_ENTRIES) nav_cache.clear();
}

/**
 * The navigation of the user behind one Authorization header, straight
 * from the main backend. Resolves to { ok: true, nav } or
 * { ok: false, status } where status is 401 (token refused upstream) or
 * 503 (main backend unreachable / unexpected answer).
 */
async function fetch_navigation(auth_header) {
  if (!auth_header) return { ok: false, status: 401 };
  const hit = nav_cache.get(auth_header);
  if (hit && hit.expires > Date.now()) return { ok: true, nav: hit.nav };

  try {
    const response = await fetch(`${config.cok_api_url}/roles/navigation`, {
      method: "GET",
      headers: { Authorization: auth_header, Accept: "application/json" },
    });
    if (response.status === 401 || response.status === 403) return { ok: false, status: 401 };
    if (!response.ok) return { ok: false, status: 503 };
    const body = await response.json();
    const nav = body && body.data;
    if (!nav || !Array.isArray(nav.links)) return { ok: false, status: 503 };
    prune_cache();
    nav_cache.set(auth_header, { nav, expires: Date.now() + NAV_CACHE_TTL_MS });
    return { ok: true, nav };
  } catch (error) {
    console.error("[RBAC] navigation lookup failed:", error.message);
    return { ok: false, status: 503 };
  }
}

function has_link(nav, link_id) {
  return !!nav && (nav.links || []).some((link) => link && link.id === link_id);
}

module.exports = {
  FORBIDDEN_MESSAGE,
  DCS_LINK_ID,
  forbidden_body,
  fetch_navigation,
  has_link,
};
