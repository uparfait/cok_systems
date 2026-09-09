const fs = require('fs');
const path = require('path');
const Role = require('../models/default_roles');

const DEFAULTS_PATH = path.join(__dirname, '..', 'configurations', 'Default_Roles.json');

let cached = null;
function loadDefaults() {
    if (!cached) {
        cached = JSON.parse(fs.readFileSync(DEFAULTS_PATH, 'utf8'));
    }
    return cached;
}

function slugify(name) {
    const slug = String(name || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || 'user';
}

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Maps a free-text role_name to one of the default role slugs.
 * Mirrors the frontend getRoleSlug rules so both sides agree.
 * Returns null when the role matches no default role.
 */
function matchDefaultSlug(roleName) {
    const n = String(roleName || '').toLowerCase().trim();
    if (!n) return null;
    if (n === 'system admin' || (n.includes('admin') && n.includes('system'))) return 'system-admin';
    if (n.includes('receptionist')) return 'receptionist';
    if (n.includes('mayor')) return 'mayor';
    if (['department manager', 'department head', 'head of department', 'director'].some((k) => n.includes(k))) return 'department-manager';
    if (n.includes('gate') && n.includes('vehicle')) return 'gate-officer';
    if (n.includes('event manager') || n.includes('event-manager')) return 'event-manager';
    if ((n.includes('manager') || n.includes('head')) && !n.includes('receptionist')) return 'department-manager';
    if (['employee', 'staff', 'officer', 'clerk'].some((k) => n.includes(k))) return 'employee';
    if (n.includes('admin')) return 'system-admin';
    return null;
}

function applyPlaceholder(value, slug) {
    return String(value || '').split('{roleSlug}').join(slug);
}

function applyPlaceholders(links, slug) {
    return (links || []).map((link) => ({
        ...link,
        path: applyPlaceholder(link.path, slug),
        children: (link.children || []).map((child) => ({
            ...child,
            path: applyPlaceholder(child.path, slug),
        })),
    }));
}

/**
 * Builds the link list for a custom role from its stored nav_links
 * ([{ id, children: [childId] }]) against the shared link catalog.
 * Unknown ids are ignored; omitting children keeps all of them.
 */
function resolveCatalogLinks(navLinks) {
    const catalog = loadDefaults().link_catalog || [];
    const byId = new Map(catalog.map((l) => [l.id, l]));
    const resolved = [];
    (navLinks || []).forEach((entry) => {
        const id = typeof entry === 'string' ? entry : entry?.id;
        const link = byId.get(id);
        if (!link) return;
        let children = link.children || [];
        if (entry && typeof entry === 'object' && Array.isArray(entry.children)) {
            const wanted = new Set(entry.children);
            children = children.filter((c) => wanted.has(c.id));
        }
        resolved.push({
            id: link.id,
            label: link.label,
            path: link.path,
            icon: link.icon,
            children,
        });
    });
    return resolved;
}

/**
 * Validates stored nav_links against the catalog; returns error strings.
 */
function validateNavLinks(navLinks) {
    const errors = [];
    if (!Array.isArray(navLinks)) return ['nav_links must be an array'];
    const catalog = loadDefaults().link_catalog || [];
    const byId = new Map(catalog.map((l) => [l.id, l]));
    navLinks.forEach((entry, i) => {
        const id = typeof entry === 'string' ? entry : entry?.id;
        const link = byId.get(id);
        if (!link) {
            errors.push(`Unknown link "${id}" at index ${i}`);
            return;
        }
        if (entry && typeof entry === 'object' && Array.isArray(entry.children)) {
            const validChildren = new Set((link.children || []).map((c) => c.id));
            entry.children.forEach((cid) => {
                if (!validChildren.has(cid)) errors.push(`Unknown child "${cid}" for link "${id}"`);
            });
        }
    });
    return errors;
}

/**
 * Resolves the navigation payload for a user's role_name:
 * 1. a custom role with configured nav_links wins,
 * 2. otherwise the matching default role,
 * 3. otherwise a minimal calendar-only fallback.
 */
async function resolveNavigation(roleName) {
    const defaults = loadDefaults();
    const name = String(roleName || '').trim();

    if (name) {
        try {
            const doc = await Role.findOne({
                role_name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
            }).lean();
            if (doc && Array.isArray(doc.nav_links) && doc.nav_links.length > 0) {
                const slug = slugify(doc.role_name);
                return {
                    role_name: doc.role_name,
                    role_slug: slug,
                    is_default: false,
                    default_route: applyPlaceholder(doc.default_route || '/calendar', slug),
                    links: applyPlaceholders(resolveCatalogLinks(doc.nav_links), slug),
                    nav_version: `custom:${doc._id}:${doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0}`,
                };
            }
        } catch (err) {
            console.error('Navigation lookup failed, falling back to defaults:', err.message);
        }
    }

    const slug = matchDefaultSlug(name);
    const def = (defaults.default_roles || []).find((r) => r.role_slug === slug);
    if (def) {
        return {
            role_name: def.role_name,
            role_slug: def.role_slug,
            is_default: true,
            default_route: def.default_route,
            links: applyPlaceholders(def.links, def.role_slug),
            nav_version: `default:${defaults.version}:${def.role_slug}`,
        };
    }

    const fallbackSlug = slugify(name);
    const calendar = (defaults.link_catalog || []).find((l) => l.id === 'calender');
    return {
        role_name: name || 'user',
        role_slug: fallbackSlug,
        is_default: false,
        default_route: '/calendar',
        links: calendar ? applyPlaceholders([calendar], fallbackSlug) : [],
        nav_version: `unknown:${defaults.version}`,
    };
}

module.exports = {
    loadDefaults,
    slugify,
    matchDefaultSlug,
    resolveNavigation,
    resolveCatalogLinks,
    validateNavLinks,
    applyPlaceholders,
};
