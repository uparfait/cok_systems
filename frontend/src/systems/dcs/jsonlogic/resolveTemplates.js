import { generate_field_id } from "../fields/fieldTypes.js";
import { get_template } from "../services/templatesService.js";

/**
 * Walks a set of fields (recursing into group/section children) and maps
 * every one of their own ids to a freshly generated replacement - built
 * once for the whole set being cloned together, so a field's internal
 * cross-reference to a SIBLING field (parent_option_groups,
 * cascading_select's parent_field_id, a visibility_condition or validation
 * rule pointing at another field in the same template) can be rewritten to
 * that sibling's own new id instead of being left pointing at an id that no
 * longer exists anywhere in the cloned copy. Mirrors
 * dc_backend/jsonlogic/resolve_templates.js - keep both in sync.
 */
function build_id_remap(fields, accumulator) {
  const id_map = accumulator || new Map();
  (fields || []).forEach((field) => {
    if (!field || !field.id) return;
    id_map.set(field.id, generate_field_id(field.type));
    if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
      build_id_remap(field.children, id_map);
    }
  });
  return id_map;
}

function remapped_id(id, id_map) {
  return id_map.has(id) ? id_map.get(id) : id;
}

/**
 * Deep-walks a JSONLogic node (a visibility_condition, computed formula, or
 * validation rule condition) rewriting every {var: "<id>"} / {var:
 * "<id>.sub.path"} reference through id_map - only the leading id segment
 * is ever a field id, so a duration field's own "field_id.hours"/".minutes"
 * sub-path is preserved untouched.
 */
function remap_condition_field_ids(node, id_map) {
  if (Array.isArray(node)) return node.map((item) => remap_condition_field_ids(item, id_map));
  if (node && typeof node === "object") {
    const next = {};
    Object.keys(node).forEach((key) => {
      if (key === "var" && typeof node[key] === "string") {
        const [head, ...rest] = node[key].split(".");
        next[key] = [remapped_id(head, id_map)].concat(rest).join(".");
        return;
      }
      next[key] = remap_condition_field_ids(node[key], id_map);
    });
    return next;
  }
  return node;
}

/**
 * Deep-clones a resolved template field (and, for a group/section, its
 * children) with a fresh id at every level - and, using id_map (built once
 * for the whole set of fields being cloned together, see build_id_remap),
 * rewrites every reference this field makes to another field in that same
 * set: a cascading_select's parent_field_id, a parent-option-group's own
 * parent_field_id, a visibility_condition, a computed formula, and a
 * validation rule's own parent_field_id/condition. Tags each field with
 * __is__template__ so its origin stays visible after it becomes an
 * ordinary field on the form/template that imported it.
 */
function clone_resolved_field(field, template_id, id_map) {
  const cloned = Object.assign({}, field, { id: remapped_id(field.id, id_map), __is__template__: template_id });

  if (cloned.parent_field_id) {
    cloned.parent_field_id = remapped_id(cloned.parent_field_id, id_map);
  }
  if (cloned.visibility_condition) {
    cloned.visibility_condition = remap_condition_field_ids(cloned.visibility_condition, id_map);
  }
  if (cloned.computed && cloned.computed.formula) {
    cloned.computed = Object.assign({}, cloned.computed, { formula: remap_condition_field_ids(cloned.computed.formula, id_map) });
  }
  if (Array.isArray(cloned.validation_rules)) {
    cloned.validation_rules = cloned.validation_rules.map((rule) => {
      const next_rule = Object.assign({}, rule);
      if (next_rule.parent_field_id) next_rule.parent_field_id = remapped_id(next_rule.parent_field_id, id_map);
      if (next_rule.condition) next_rule.condition = remap_condition_field_ids(next_rule.condition, id_map);
      return next_rule;
    });
  }
  if (Array.isArray(cloned.parent_option_groups)) {
    cloned.parent_option_groups = cloned.parent_option_groups.map((group) =>
      Object.assign({}, group, {
        id: generate_field_id("group"),
        parent_field_id: group.parent_field_id ? remapped_id(group.parent_field_id, id_map) : group.parent_field_id,
      }),
    );
  }

  if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
    cloned.children = field.children.map((child) => clone_resolved_field(child, template_id, id_map));
  }
  return cloned;
}

/**
 * Clones a whole set of resolved template fields together, sharing one
 * id-remap map across all of them (including nested group/section
 * children) so any cross-reference between two fields in the set - however
 * deeply nested - resolves to the right new id. Always the entry point;
 * never call the internal clone_resolved_field directly, or
 * cross-references silently break (the exact bug this fixes).
 */
export function clone_resolved_fields(fields, template_id) {
  const id_map = build_id_remap(fields);
  return (fields || []).map((field) => clone_resolved_field(field, template_id, id_map));
}

/**
 * Same idea, for the "insert template" picker specifically: the author can
 * uncheck some of a template's top-level fields before inserting, but a
 * cross-reference (e.g. a district field's parent-option-groups pointing at
 * the province field) must still resolve correctly as long as the field it
 * points to is ALSO part of this template - so the id map is built from
 * every field the template has (all_fields), not just the ones actually
 * being cloned/returned (selected_fields). A reference to a field the
 * author deliberately excluded is left pointing at that field's original
 * id, since there is nothing else it could correctly mean.
 */
export function clone_selected_fields(all_fields, selected_fields, template_id) {
  const id_map = build_id_remap(all_fields);
  return (selected_fields || []).map((field) => clone_resolved_field(field, template_id, id_map));
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
          return clone_resolved_fields(resolved, template_id);
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
        return clone_resolved_fields(resolved, template_id);
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
