const fs = require("fs");
const path = require("path");
const { get_cok_db } = require("../db_connection/db.js");

/**
 * Local mirror of backend/utilities/navigation.js: resolves the navigation
 * (sidebar links) of a role name from the shared catalog
 * (configurations/Default_Roles.json - keep in sync with the main backend's
 * copy) and the main system's "roles" collection, which this service reads
 * from the cok database it is already connected to. A role's navigation is
 * what decides which systems it may use, so nothing has to be asked of the
 * main backend at request time.
 */

const DEFAULTS_PATH = path.join(__dirname, "..", "configurations", "Default_Roles.json");
const NAV_CACHE_TTL_MS = 60 * 1000;

let cached_defaults = null;
const nav_cache = new Map();

function load_defaults() {
  if (!cached_defaults) cached_defaults = JSON.parse(fs.readFileSync(DEFAULTS_PATH, "utf8"));
  return cached_defaults;
}

function slugify(name) {
  const slug = String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "user";
}

function escape_regex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function match_default_slug(role_name) {
  const n = String(role_name || "").toLowerCase().trim();
  if (!n) return null;
  // A default role's exact name always wins over the keyword rules below.
  const exact = (load_defaults().default_roles || []).find((role) => role.role_name.toLowerCase() === n);
  if (exact) return exact.role_slug;
  if (n === "system admin" || (n.includes("admin") && n.includes("system"))) return "system-admin";
  if (n.includes("receptionist")) return "receptionist";
  if (n.includes("mayor")) return "mayor";
  if (["department manager", "department head", "head of department", "director"].some((k) => n.includes(k))) return "department-manager";
  if (n.includes("gate") || n.includes("vehicle registrar")) return "gate-officer";
  if (n.includes("event manager") || n.includes("event-manager")) return "event-manager";
  if ((n.includes("manager") || n.includes("head")) && !n.includes("receptionist")) return "department-manager";
  if (["employee", "staff", "officer", "clerk"].some((k) => n.includes(k))) return "employee";
  if (n.includes("admin")) return "system-admin";
  return null;
}

function apply_placeholder(value, slug) {
  return String(value || "").split("{roleSlug}").join(slug);
}

function apply_placeholders(links, slug) {
  return (links || []).map((link) =>
    Object.assign({}, link, {
      path: apply_placeholder(link.path, slug),
      children: (link.children || []).map((child) => Object.assign({}, child, { path: apply_placeholder(child.path, slug) })),
    }),
  );
}

/** Custom role nav_links against the catalog; an empty children list means every child. */
function resolve_catalog_links(nav_links) {
  const catalog = load_defaults().link_catalog || [];
  const by_id = new Map(catalog.map((link) => [link.id, link]));
  const resolved = [];
  (nav_links || []).forEach((entry) => {
    const id = typeof entry === "string" ? entry : entry && entry.id;
    const link = by_id.get(id);
    if (!link) return;
    let children = link.children || [];
    if (entry && typeof entry === "object" && Array.isArray(entry.children) && entry.children.length > 0) {
      const wanted = new Set(entry.children);
      children = children.filter((child) => wanted.has(child.id));
    }
    resolved.push({ id: link.id, label: link.label, path: link.path, icon: link.icon, children });
  });
  return resolved;
}

async function find_custom_role(role_name) {
  try {
    return await get_cok_db()
      .collection("roles")
      .findOne({ role_name: new RegExp(`^${escape_regex(role_name)}$`, "i") });
  } catch (error) {
    console.error("[RBAC] role lookup failed, falling back to defaults:", error.message);
    return null;
  }
}

/**
 * 1. a custom role with configured nav_links, 2. the matching default role,
 * 3. a calendar-only fallback - same order as the main backend.
 */
async function resolve_navigation(role_name) {
  const defaults = load_defaults();
  const name = String(role_name || "").trim();

  if (name) {
    const doc = await find_custom_role(name);
    if (doc && Array.isArray(doc.nav_links) && doc.nav_links.length > 0) {
      const slug = slugify(doc.role_name);
      return {
        role_name: doc.role_name,
        role_slug: slug,
        is_default: false,
        default_route: apply_placeholder(doc.default_route || "/calendar", slug),
        links: apply_placeholders(resolve_catalog_links(doc.nav_links), slug),
      };
    }
  }

  const slug = match_default_slug(name);
  const def = (defaults.default_roles || []).find((role) => role.role_slug === slug);
  if (def) {
    return {
      role_name: def.role_name,
      role_slug: def.role_slug,
      is_default: true,
      default_route: def.default_route,
      links: apply_placeholders(def.links, def.role_slug),
    };
  }

  const fallback_slug = slugify(name);
  const calendar = (defaults.link_catalog || []).find((link) => link.id === "calender");
  return {
    role_name: name || "user",
    role_slug: fallback_slug,
    is_default: false,
    default_route: "/calendar",
    links: calendar ? apply_placeholders([calendar], fallback_slug) : [],
  };
}

/** Same answer kept per role name for a minute - roles change rarely. */
async function resolve_navigation_cached(role_name) {
  const key = String(role_name || "").trim().toLowerCase();
  const hit = nav_cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.nav;
  const nav = await resolve_navigation(role_name);
  nav_cache.set(key, { nav, expires: Date.now() + NAV_CACHE_TTL_MS });
  return nav;
}

module.exports = {
  load_defaults,
  slugify,
  match_default_slug,
  resolve_catalog_links,
  resolve_navigation,
  resolve_navigation_cached,
};
