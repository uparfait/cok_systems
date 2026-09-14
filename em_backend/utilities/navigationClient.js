const config = require('../configurations/config');

/**
 * Role-based access for the event service. The main backend is the single
 * source of truth for "which systems may this role use": it resolves a
 * role's navigation (sidebar links) from Default_Roles.json and the roles
 * collection. Rather than duplicating that here, the caller's own bearer
 * token is forwarded to GET /roles/navigation and the answer is kept for a
 * short while per token.
 */

const FORBIDDEN_MESSAGE = 'BC::: YOU ARE NOT ALLOWED TO USE THIS RESOURCE';
const NAV_CACHE_TTL_MS = 60 * 1000;
const NAV_CACHE_MAX_ENTRIES = 5000;

const navCache = new Map();

function forbiddenBody(detail) {
  return {
    success: false,
    type: 'warning',
    forbidden_resource: true,
    goto_login: true,
    message: FORBIDDEN_MESSAGE,
    error: detail || 'Your role does not grant access to event management',
  };
}

function pruneCache() {
  if (navCache.size < NAV_CACHE_MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of navCache) {
    if (entry.expires <= now) navCache.delete(key);
  }
  if (navCache.size >= NAV_CACHE_MAX_ENTRIES) navCache.clear();
}

/**
 * Resolves to { ok: true, nav } or { ok: false, status } where status is
 * 401 (token refused by the main backend) or 503 (main backend unreachable
 * or answered unexpectedly).
 */
async function fetchNavigation(authHeader) {
  if (!authHeader) return { ok: false, status: 401 };
  const hit = navCache.get(authHeader);
  if (hit && hit.expires > Date.now()) return { ok: true, nav: hit.nav };

  try {
    const response = await fetch(`${config.cokApiUrl}/roles/navigation`, {
      method: 'GET',
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });
    if (response.status === 401 || response.status === 403) return { ok: false, status: 401 };
    if (!response.ok) return { ok: false, status: 503 };
    const body = await response.json();
    const nav = body && body.data;
    if (!nav || !Array.isArray(nav.links)) return { ok: false, status: 503 };
    pruneCache();
    navCache.set(authHeader, { nav, expires: Date.now() + NAV_CACHE_TTL_MS });
    return { ok: true, nav };
  } catch (error) {
    console.error('[RBAC] navigation lookup failed:', error.message);
    return { ok: false, status: 503 };
  }
}

function hasLink(nav, linkId) {
  return !!nav && (nav.links || []).some((link) => link && link.id === linkId);
}

function hasSlug(nav, slug) {
  return !!nav && String(nav.role_slug || '').toLowerCase() === String(slug).toLowerCase();
}

module.exports = { FORBIDDEN_MESSAGE, forbiddenBody, fetchNavigation, hasLink, hasSlug };
