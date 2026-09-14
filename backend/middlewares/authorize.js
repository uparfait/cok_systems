/**
 * Authorization middleware - runs AFTER authenticate. Resolves the
 * navigation of the caller's role (the same links the sidebar shows them),
 * turns it into an access set and refuses the request with the shared
 * "BC::: YOU ARE NOT ALLOWED TO USE THIS RESOURCE" body when none of the
 * requirements are met. The frontend reacts to forbidden_resource by
 * logging the user out.
 */

const navigation = require('../utilities/navigation');
const policy = require('../utilities/access_policy');

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function notAuthenticated(res) {
    return res.status(401).json({
        success: false,
        type: 'warning',
        goto_login: true,
        message: 'Your are required to login',
        error: 'Authentication is required before authorization',
    });
}

/**
 * The caller's access set, computed once per request and reused by every
 * authorize() layer the request passes through.
 */
async function loadAccess(req) {
    if (req.access) return req.access;
    const roleName = req.user.role_name || req.user.role || '';
    const nav = await navigation.resolveNavigationCached(roleName);
    req.navigation = nav;
    req.access = policy.buildAccessSet(nav, req.user);
    return req.access;
}

function deny(req, res) {
    const who = (req.user && req.user.email) || 'unknown';
    const role = (req.user && (req.user.role_name || req.user.role)) || 'no role';
    console.warn(`[RBAC] ${who} (${role}) denied ${req.method} ${req.originalUrl}`);
    return res.status(403).json(policy.forbiddenBody(`${req.method} ${req.originalUrl} is outside your role's systems`));
}

/**
 * Allows the request when the caller holds ANY of the requirement tokens
 * (see utilities/access_policy.js). No requirements = any authenticated user.
 */
function authorize(requirements) {
    return async (req, res, next) => {
        try {
            if (!req.user) return notAuthenticated(res);
            const access = await loadAccess(req);
            if (policy.hasAccess(access, requirements || [])) return next();
            return deny(req, res);
        } catch (error) {
            console.error('[RBAC] authorization failed:', error);
            return res.status(500).json({ success: false, type: 'error', message: 'Authorization check failed', error: error.message });
        }
    };
}

/**
 * Different requirements for reads (GET/HEAD/OPTIONS) and writes. Either
 * side may be omitted to mean "any authenticated user".
 */
function authorizeByMethod({ read, write }) {
    const readCheck = authorize(read || []);
    const writeCheck = authorize(write || []);
    return (req, res, next) => (READ_METHODS.has(req.method) ? readCheck(req, res, next) : writeCheck(req, res, next));
}

/**
 * A user may always act on their own record (route param equals their id);
 * anyone else needs the requirements.
 */
function authorizeOwnOr(paramName, requirements) {
    const check = authorize(requirements);
    return (req, res, next) => {
        if (!req.user) return notAuthenticated(res);
        const ownId = String(req.user.id || req.user._id || req.user.userId || '');
        if (ownId && String(req.params[paramName] || '') === ownId) return next();
        return check(req, res, next);
    };
}

module.exports = {
    authorize,
    authorizeByMethod,
    authorizeOwnOr,
    loadAccess,
};
