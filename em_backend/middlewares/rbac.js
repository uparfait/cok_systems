const { authenticateBearer } = require('./authenticate');
const { resolveNavigationCached } = require('../utilities/navigation');

/**
 * Three protection tiers, because the event API serves two audiences at
 * once: signed-in staff on the event-manager dashboard (bearer token) and
 * anonymous organizers/attendees on the public pages (no bearer, at most
 * an x-event-access-token).
 *
 *   validateBearerIfPresent  a bearer, when sent, must be a valid session
 *   requireLinksIfSignedIn   public flows pass without a bearer; a signed-in
 *                            caller must hold one of the links (or slugs)
 *   requireLinks             a bearer is mandatory AND must hold a link
 *
 * Both the session (JWT + users collection) and the role's navigation
 * (catalog + roles collection) are resolved locally - see
 * middlewares/authenticate.js and utilities/navigation.js. Requirement
 * tokens: 'events' / 'rooms' / 'booking-requests' (link ids of the shared
 * navigation catalog) or 'slug:<role-slug>'.
 */

const FORBIDDEN_MESSAGE = 'BC::: YOU ARE NOT ALLOWED TO USE THIS RESOURCE';
const EVENT_LINKS = ['events', 'rooms', 'booking-requests'];

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

function unauthorized(res) {
  return res.status(401).json({
    success: false,
    type: 'warning',
    goto_login: true,
    message: 'Your are required to login',
    error: 'Authentication is required for this resource',
  });
}

function hasLink(nav, linkId) {
  return !!nav && (nav.links || []).some((link) => link && link.id === linkId);
}

function hasSlug(nav, slug) {
  return !!nav && String(nav.role_slug || '').toLowerCase() === String(slug).toLowerCase();
}

function satisfies(nav, requirements) {
  return requirements.some((requirement) => {
    if (requirement.startsWith('slug:')) return hasSlug(nav, requirement.slice(5));
    return hasLink(nav, requirement);
  });
}

/**
 * Authenticates the bearer and loads the caller's navigation onto
 * req.user / req.navigation. Returns true when the request may continue,
 * false when a refusal has already been sent.
 */
async function resolve(req, res) {
  if (req.navigation) return true;
  const auth = await authenticateBearer(req.headers.authorization);
  if (!auth.ok) {
    res.status(auth.status).json(auth.body);
    return false;
  }
  req.user = auth.user;
  req.navigation = await resolveNavigationCached(auth.user.role);
  return true;
}

function deny(req, res, requirements) {
  const who = (req.user && req.user.email) || 'unknown';
  const role = (req.user && req.user.role) || 'no role';
  console.warn(`[RBAC] ${who} (${role}) denied ${req.method} ${req.originalUrl} (needs ${requirements.join(' | ')})`);
  return res.status(403).json(forbiddenBody(`${req.method} ${req.originalUrl} requires event management access`));
}

function guard(handler) {
  return async (req, res, next) => {
    try {
      return await handler(req, res, next);
    } catch (error) {
      console.error('[RBAC] check failed:', error);
      return res.status(500).json({ success: false, type: 'error', message: 'Authorization check failed', error: error.message });
    }
  };
}

const validateBearerIfPresent = guard(async (req, res, next) => {
  if (!req.headers.authorization) return next();
  if (await resolve(req, res)) return next();
  return undefined;
});

function requireLinksIfSignedIn(...requirements) {
  const list = requirements.length > 0 ? requirements : EVENT_LINKS;
  return guard(async (req, res, next) => {
    if (!req.headers.authorization) return next();
    if (!(await resolve(req, res))) return undefined;
    if (satisfies(req.navigation, list)) return next();
    return deny(req, res, list);
  });
}

function requireLinks(...requirements) {
  const list = requirements.length > 0 ? requirements : EVENT_LINKS;
  return guard(async (req, res, next) => {
    if (!req.headers.authorization) return unauthorized(res);
    if (!(await resolve(req, res))) return undefined;
    if (satisfies(req.navigation, list)) return next();
    return deny(req, res, list);
  });
}

module.exports = { EVENT_LINKS, FORBIDDEN_MESSAGE, validateBearerIfPresent, requireLinksIfSignedIn, requireLinks };
