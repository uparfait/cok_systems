const { fetchNavigation, hasLink, hasSlug, forbiddenBody } = require('../utilities/navigationClient');

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
 * Requirement tokens: 'events' / 'rooms' / 'booking-requests' (link ids of
 * the shared navigation catalog) or 'slug:<role-slug>'.
 */

const EVENT_LINKS = ['events', 'rooms', 'booking-requests'];

function unauthorized(res) {
  return res.status(401).json({
    success: false,
    type: 'warning',
    goto_login: true,
    message: 'Your are required to login',
    error: 'Invalid or expired session',
  });
}

function unavailable(res) {
  return res.status(503).json({
    success: false,
    type: 'error',
    message: 'Access rights could not be verified right now, please try again shortly',
    error: 'main backend unreachable',
  });
}

function satisfies(nav, requirements) {
  return requirements.some((requirement) => {
    if (requirement.startsWith('slug:')) return hasSlug(nav, requirement.slice(5));
    return hasLink(nav, requirement);
  });
}

/**
 * Loads the caller's navigation onto req.navigation. Returns true when the
 * request may continue, false when a response has already been sent.
 */
async function resolve(req, res) {
  if (req.navigation) return true;
  const result = await fetchNavigation(req.headers.authorization);
  if (result.ok) {
    req.navigation = result.nav;
    return true;
  }
  if (result.status === 401) unauthorized(res);
  else unavailable(res);
  return false;
}

function deny(req, res, requirements) {
  const role = (req.navigation && req.navigation.role_name) || 'unknown role';
  console.warn(`[RBAC] ${role} denied ${req.method} ${req.originalUrl} (needs ${requirements.join(' | ')})`);
  return res.status(403).json(forbiddenBody(`${req.method} ${req.originalUrl} requires event management access`));
}

async function validateBearerIfPresent(req, res, next) {
  if (!req.headers.authorization) return next();
  if (await resolve(req, res)) return next();
  return undefined;
}

function requireLinksIfSignedIn(...requirements) {
  const list = requirements.length > 0 ? requirements : EVENT_LINKS;
  return async (req, res, next) => {
    if (!req.headers.authorization) return next();
    if (!(await resolve(req, res))) return undefined;
    if (satisfies(req.navigation, list)) return next();
    return deny(req, res, list);
  };
}

function requireLinks(...requirements) {
  const list = requirements.length > 0 ? requirements : EVENT_LINKS;
  return async (req, res, next) => {
    if (!req.headers.authorization) return unauthorized(res);
    if (!(await resolve(req, res))) return undefined;
    if (satisfies(req.navigation, list)) return next();
    return deny(req, res, list);
  };
}

module.exports = { EVENT_LINKS, validateBearerIfPresent, requireLinksIfSignedIn, requireLinks };
