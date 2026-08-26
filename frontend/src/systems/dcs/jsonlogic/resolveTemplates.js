import { generate_field_id } from "../fields/fieldTypes.js";
import { get_template } from "../services/templatesService.js";

/**
 * Deep-clones a resolved template field (and, for a group/section, its
 * children) with a fresh id at every level, tagging each one with
 * __is__template__ so its origin stays visible after it becomes an
 * ordinary field on the form/template that imported it.
 */
export function clone_resolved_field(field, template_id) {
  const cloned = Object.assign({}, field, { id: generate_field_id(field.type), __is__template__: template_id });
  if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
    cloned.children = field.children.map((child) => clone_resolved_field(child, template_id));
  }
  return cloned;
}

/**
 * True for a __is__template__ placeholder entry - {__is__template__:
 * "<template_id>", fields: [...]} - as opposed to an ordinary (or already
 * resolved) field, which always has its own type.
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
 * a cycle. Mirrors dc_backend/jsonlogic/resolve_templates.js - keep both in
 * sync.
 */
export async function resolve_template_placeholders(fields, seen_template_ids) {
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
        let template;
        try {
          const response = await get_template(template_id);
          template = response.data;
        } catch (error) {
          return [];
        }
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
