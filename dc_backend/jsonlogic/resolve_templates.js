const templates_model = require("../models/templates_model.js");

/**
 * Generates a reasonably unique field id such as "text_a1b2c3" - mirrors
 * generate_field_id in frontend/src/systems/dcs/fields/fieldTypes.js, used
 * here so a template inserted more than once (or a template embedded by
 * more than one other template) never produces two fields sharing an id.
 */
function generate_id(prefix) {
  const random_part = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${random_part}`;
}

/**
 * Deep-clones a resolved template field (and, for a group/section, its
 * children) with a fresh id at every level, tagging each one with
 * __is__template__ so its origin stays visible after it becomes an
 * ordinary field on the form/template that imported it.
 */
function clone_resolved_field(field, template_id) {
  const cloned = Object.assign({}, field, { id: generate_id(field.type), __is__template__: template_id });
  if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
    cloned.children = field.children.map((child) => clone_resolved_field(child, template_id));
  }
  return cloned;
}

/**
 * True for a __is__template__ placeholder entry - {__is__template__:
 * "<template_id>", fields: [...]} - as opposed to an ordinary (or already
 * resolved) field, which always has its own type. A placeholder's fields
 * array is either already populated (pasted in already-expanded, nothing
 * to fetch) or empty/missing (fetch the template and expand it now).
 */
function is_template_placeholder(field) {
  return !!field && typeof field === "object" && typeof field.__is__template__ === "string" && !field.type;
}

/**
 * Walks a fields array (recursing into group/section children) and expands
 * every __is__template__ placeholder it finds into real, freshly-id'd
 * fields - fetching the referenced template only when the placeholder
 * didn't already carry its own expanded fields. A template can itself
 * embed another template's placeholder, so this resolves recursively;
 * seen_template_ids guards against two templates referencing each other in
 * a cycle. Mirrors frontend/src/systems/dcs/jsonlogic/resolveTemplates.js -
 * keep both in sync.
 */
async function resolve_template_placeholders(fields, seen_template_ids) {
  const seen = seen_template_ids || new Set();
  const expanded_groups = await Promise.all(
    (fields || []).map(async (field) => {
      if (is_template_placeholder(field)) {
        const template_id = field.__is__template__;
        if (Array.isArray(field.fields) && field.fields.length > 0) {
          const resolved = await resolve_template_placeholders(field.fields, seen);
          return resolved.map((resolved_field) => clone_resolved_field(resolved_field, template_id));
        }
        if (seen.has(template_id)) return [];
        const template = await templates_model.get_template_by_id(template_id);
        if (!template) return [];
        const next_seen = new Set(seen);
        next_seen.add(template_id);
        const resolved = await resolve_template_placeholders(template.fields || [], next_seen);
        return resolved.map((resolved_field) => clone_resolved_field(resolved_field, template_id));
      }

      if (field && (field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
        const resolved_children = await resolve_template_placeholders(field.children, seen);
        return [Object.assign({}, field, { children: resolved_children })];
      }

      return [field];
    }),
  );
  return expanded_groups.flat();
}

module.exports = {
  resolve_template_placeholders,
};
