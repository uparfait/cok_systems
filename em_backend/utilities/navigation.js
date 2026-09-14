const fs = require('fs');
const path = require('path');
const { cokCollection } = require('./cokDb');

/**
 * Local mirror of backend/utilities/navigation.js: resolves the navigation
 * (sidebar links) of a role name from the shared catalog
 * (configurations/Default_Roles.json - keep in sync with the main backend's
 * copy) and the main system's "roles" collection in the cok database. A
 * role's navigation is what decides which systems it may use, so nothing
 * has to be asked of the main backend at request time.
 */

const DEFAULTS_PATH = path.join(__dirname, '..', 'configurations', 'Default_Roles.json');
const NAV_CACHE_TTL_MS = 60 * 1000;

let cachedDefaults = null;
const navCache = new Map();

function loadDefaults() {
  if (!cachedDefaults) cachedDefaults = JSON.parse(fs.readFileSync(DEFAULTS_PATH, 'utf8'));
  return cachedDefaults;
}

function slugify(name) {
  const slug = String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'user';
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchDefaultSlug(roleName) {
  const n = String(roleName || '').toLowerCase().trim();
  if (!n) return null;
  // A default role's exact name always wins over the keyword rules below.
  const exact = (loadDefaults().default_roles || []).find((role) => role.role_name.toLowerCase() === n);
  if (exact) return exact.role_slug;
  if (n === 'system admin' || (n.includes('admin') && n.includes('system'))) return 'system-admin';
  if (n.includes('receptionist')) return 'receptionist';
  if (n.includes('mayor')) return 'mayor';
  if (['department manager', 'department head', 'head of department', 'director'].some((k) => n.includes(k))) return 'department-manager';
  if (n.includes('gate') || n.includes('vehicle registrar')) return 'gate-officer';
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
    children: (link.children || []).map((child) => ({ ...child, path: applyPlaceholder(child.path, slug) })),
  }));
}

// Custom role nav_links against the catalog; an empty children list means every child.
function resolveCatalogLinks(navLinks) {
  const catalog = loadDefaults().link_catalog || [];
  const byId = new Map(catalog.map((link) => [link.id, link]));
  const resolved = [];
  (navLinks || []).forEach((entry) => {
    const id = typeof entry === 'string' ? entry : entry && entry.id;
    const link = byId.get(id);
    if (!link) return;
    let children = link.children || [];
    if (entry && typeof entry === 'object' && Array.isArray(entry.children) && entry.children.length > 0) {
      const wanted = new Set(entry.children);
      children = children.filter((child) => wanted.has(child.id));
    }
    resolved.push({ id: link.id, label: link.label, path: link.path, icon: link.icon, children });
  });
  return resolved;
}

async function findCustomRole(roleName) {
  try {
    const roles = await cokCollection('roles');
    return await roles.findOne({ role_name: new RegExp(`^${escapeRegex(roleName)}$`, 'i') });
  } catch (error) {
    console.error('[RBAC] role lookup failed, falling back to defaults:', error.message);
    return null;
  }
}

async function resolveNavigation(roleName) {
  const defaults = loadDefaults();
  const name = String(roleName || '').trim();

  if (name) {
    const doc = await findCustomRole(name);
    if (doc && Array.isArray(doc.nav_links) && doc.nav_links.length > 0) {
      const slug = slugify(doc.role_name);
      return {
        role_name: doc.role_name,
        role_slug: slug,
        is_default: false,
        default_route: applyPlaceholder(doc.default_route || '/calendar', slug),
        links: applyPlaceholders(resolveCatalogLinks(doc.nav_links), slug),
      };
    }
  }

  const slug = matchDefaultSlug(name);
  const def = (defaults.default_roles || []).find((role) => role.role_slug === slug);
  if (def) {
    return { role_name: def.role_name, role_slug: def.role_slug, is_default: true, default_route: def.default_route, links: applyPlaceholders(def.links, def.role_slug) };
  }

  const fallbackSlug = slugify(name);
  const calendar = (defaults.link_catalog || []).find((link) => link.id === 'calender');
  return { role_name: name || 'user', role_slug: fallbackSlug, is_default: false, default_route: '/calendar', links: calendar ? applyPlaceholders([calendar], fallbackSlug) : [] };
}

async function resolveNavigationCached(roleName) {
  const key = String(roleName || '').trim().toLowerCase();
  const hit = navCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.nav;
  const nav = await resolveNavigation(roleName);
  navCache.set(key, { nav, expires: Date.now() + NAV_CACHE_TTL_MS });
  return nav;
}

module.exports = { loadDefaults, slugify, matchDefaultSlug, resolveCatalogLinks, resolveNavigation, resolveNavigationCached };
