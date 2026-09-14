/**
 * Access policy shared by every authorization check of the main backend.
 *
 * The single source of truth for "which systems may this role use" is the
 * role's navigation (configurations/Default_Roles.json for default roles,
 * the role document's nav_links for custom roles). A user may call an API
 * only when the navigation of their role carries a link (or a child link)
 * for the system that API belongs to - exactly the pages the sidebar shows
 * them. Requirement tokens:
 *   link:<linkId>            the role's navigation carries this top link
 *   child:<linkId>:<childId> the role's navigation carries this child link
 *   slug:<roleSlug>          the role resolves to this slug (default roles)
 *   auth                     any authenticated user
 */

const FORBIDDEN_MESSAGE = 'BC::: YOU ARE NOT ALLOWED TO USE THIS RESOURCE';

function normalize(value) {
    return String(value || '').trim().toLowerCase();
}

/**
 * The exact "System Admin" role sees every admin child regardless of the
 * per-child permission tags (mirrors isAdminRole on the frontend).
 */
function isFullAdmin(roleName) {
    return normalize(roleName) === 'system admin';
}

/**
 * Resource names the user holds any action on, lowercased - the same set
 * the frontend derives in layoutUtils.buildPermissionSet.
 */
function buildPermissionSet(permissions) {
    const set = new Set();
    (Array.isArray(permissions) ? permissions : []).forEach((perm) => {
        const resource = perm && (perm.resource || perm.resource_name);
        if (!resource) return;
        const actions = Array.isArray(perm.actions) ? perm.actions : [];
        if (actions.length === 0) return;
        set.add(normalize(resource));
    });
    return set;
}

/**
 * Everything one user is allowed to reach, as requirement tokens, derived
 * from the navigation resolved for their role.
 */
function buildAccessSet(navigation, user) {
    const access = new Set(['auth']);
    if (!navigation) return access;

    const fullAdmin = isFullAdmin(user && (user.role_name || user.role));
    const held = buildPermissionSet(user && user.permissions);
    const allowed = (entry) => !entry.permission || fullAdmin || held.has(normalize(entry.permission));

    if (navigation.role_slug) access.add(`slug:${normalize(navigation.role_slug)}`);

    (navigation.links || []).forEach((link) => {
        if (!link || !link.id || !allowed(link)) return;
        access.add(`link:${link.id}`);
        (link.children || []).forEach((child) => {
            if (!child || !child.id || !allowed(child)) return;
            access.add(`child:${link.id}:${child.id}`);
        });
    });
    return access;
}

/**
 * True when the user holds ANY of the requirements. An empty requirement
 * list means "any authenticated user".
 */
function hasAccess(accessSet, requirements) {
    const list = Array.isArray(requirements) ? requirements : [requirements];
    if (list.length === 0) return true;
    return list.some((requirement) => accessSet.has(requirement));
}

function forbiddenBody(detail) {
    return {
        success: false,
        type: 'warning',
        forbidden_resource: true,
        goto_login: true,
        message: FORBIDDEN_MESSAGE,
        error: detail || 'Your role does not grant access to this resource',
    };
}

// ---- Requirement groups, one per system --------------------------------

const ADMIN = ['link:admin', 'slug:system-admin'];

const ADMIN_EMPLOYEES = ['child:admin:employees', 'child:admin:user-management', 'slug:system-admin'];
const ADMIN_DEPARTMENTS = ['child:admin:departments', 'slug:system-admin'];
const ADMIN_ROLES_READ = ['child:admin:roles-management', 'child:admin:user-management', 'child:admin:employees', 'slug:system-admin'];
const ADMIN_ROLES_WRITE = ['child:admin:roles-management', 'slug:system-admin'];
const ADMIN_AUDIT = ['child:admin:system-audit', 'slug:system-admin'];
const ADMIN_STORAGE = ['child:admin:storage-management', 'slug:system-admin'];

const SERVICE_DELIVERY = [
    'link:visitors', 'link:assigned-visitors', 'link:history', 'link:queue', 'link:requests',
    'link:my-employees', 'link:hod-feedback', 'link:service-delivery', 'link:check-in', 'link:check-out',
    'slug:receptionist', 'slug:employee', 'slug:department-manager', 'slug:gate-officer',
].concat(ADMIN);

const SMART_PARKING = ['link:smart-parking', 'link:check-in', 'link:check-out', 'slug:gate-officer'].concat(ADMIN);

const EVENTS = ['link:events', 'link:rooms', 'link:booking-requests', 'slug:event-manager'].concat(ADMIN);

const DEPARTMENT_MANAGER = ['link:my-employees', 'link:hod-feedback', 'slug:department-manager'].concat(ADMIN);

const REQUESTS = ['link:requests', 'slug:receptionist', 'slug:department-manager', 'slug:mayor', 'link:feedback-analysis'].concat(ADMIN);

const FEEDBACK_READ = ['link:service-delivery', 'link:hod-feedback', 'link:feedback-analysis', 'slug:mayor', 'slug:department-manager'].concat(ADMIN);

const ANALYTICS = Array.from(new Set([].concat(SERVICE_DELIVERY, SMART_PARKING, ['link:feedback-analysis', 'slug:mayor'])));

const TASKS = ['link:task-manager'];

module.exports = {
    FORBIDDEN_MESSAGE,
    isFullAdmin,
    buildPermissionSet,
    buildAccessSet,
    hasAccess,
    forbiddenBody,
    GROUPS: {
        ADMIN,
        ADMIN_EMPLOYEES,
        ADMIN_DEPARTMENTS,
        ADMIN_ROLES_READ,
        ADMIN_ROLES_WRITE,
        ADMIN_AUDIT,
        ADMIN_STORAGE,
        SERVICE_DELIVERY,
        SMART_PARKING,
        EVENTS,
        DEPARTMENT_MANAGER,
        REQUESTS,
        FEEDBACK_READ,
        ANALYTICS,
        TASKS,
    },
};
