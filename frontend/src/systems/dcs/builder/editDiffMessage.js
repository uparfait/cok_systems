import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";
import { DCS_FIELD_TYPE_REGISTRY } from "../fields/fieldTypes.js";

/**
 * Turns one builder mutation into a record of what actually changed,
 * derived by comparing the fields before and after rather than reported by
 * each call site - so every edit is tracked, including ones made through
 * the code overlay or a drag, without any of them having to remember to
 * say so.
 *
 * A record is { message_key, message_vars }, never a finished sentence:
 * the history has to read in whichever language it is opened in, long
 * after the edit was made. A var is a plain string, { translate_key } for
 * something from the catalogs (a field type name), or { text } holding a
 * whole translated-text object (an author's own label) - see
 * resolve_track_vars.
 */

function type_label_var(field_type) {
  const entry = DCS_FIELD_TYPE_REGISTRY.find((candidate) => candidate.type === field_type);
  return entry ? { translate_key: entry.labelKey } : String(field_type);
}

function label_var(field) {
  return { text: field.label, fallback_key: "DCS_TRACK_UNTITLED" };
}

/**
 * Resolves a record's vars into strings for display, in the language the
 * history is being read in right now.
 */
export function resolve_track_vars(message_vars, translate, language) {
  const resolved = {};
  Object.keys(message_vars || {}).forEach((name) => {
    const value = message_vars[name];
    if (value && typeof value === "object" && value.translate_key) {
      resolved[name] = translate(value.translate_key);
    } else if (value && typeof value === "object" && "text" in value) {
      const text = get_field_text(value.text, language);
      resolved[name] = text || (value.fallback_key ? translate(value.fallback_key) : "");
    } else {
      resolved[name] = value;
    }
  });
  return resolved;
}

export function track_message_text(record, translate, language) {
  if (!record || !record.message_key) return "";
  return translate(record.message_key, resolve_track_vars(record.message_vars, translate, language));
}

function fields_by_id(fields) {
  const map = new Map();
  flatten_fields(fields || []).forEach((field) => {
    if (field && field.id) map.set(field.id, field);
  });
  return map;
}

function top_level_order(fields) {
  return (fields || []).map((field) => field.id).join("|");
}

const TEXT_KEYS = ["help_text", "placeholder", "valid_message", "content", "text"];
const OPTION_KEYS = ["options", "parent_option_groups", "parent_dependency_enabled", "parent_field_id", "scale_size", "low_label", "high_label"];
const VALIDATION_KEYS = ["validation_rules", "length_limit_ui", "accepted_file_types", "file_size_limit"];
const VISIBILITY_KEYS = ["visibility_condition", "visibility_condition_ui"];

function changed_keys(previous_field, next_field) {
  const names = new Set(Object.keys(previous_field).concat(Object.keys(next_field)));
  const changed = [];
  names.forEach((name) => {
    if (JSON.stringify(previous_field[name]) !== JSON.stringify(next_field[name])) changed.push(name);
  });
  return changed;
}

function single_field_record(previous_field, next_field) {
  const changed = changed_keys(previous_field, next_field);

  if (changed.includes("type")) {
    return {
      message_key: "DCS_TRACK_CONVERTED_FIELD",
      message_vars: {
        label: label_var(next_field),
        from: type_label_var(previous_field.type),
        to: type_label_var(next_field.type),
      },
    };
  }

  if (changed.includes("label")) {
    return {
      message_key: "DCS_TRACK_RENAMED_FIELD",
      message_vars: { from: label_var(previous_field), to: label_var(next_field) },
    };
  }

  if (changed.includes("mandatory")) {
    return {
      message_key: next_field.mandatory ? "DCS_TRACK_REQUIRED_FIELD" : "DCS_TRACK_OPTIONAL_FIELD",
      message_vars: { label: label_var(next_field) },
    };
  }

  if (changed.some((name) => OPTION_KEYS.includes(name))) {
    return { message_key: "DCS_TRACK_OPTIONS_FIELD", message_vars: { label: label_var(next_field) } };
  }
  if (changed.some((name) => VALIDATION_KEYS.includes(name))) {
    return { message_key: "DCS_TRACK_VALIDATION_FIELD", message_vars: { label: label_var(next_field) } };
  }
  if (changed.some((name) => VISIBILITY_KEYS.includes(name))) {
    return { message_key: "DCS_TRACK_VISIBILITY_FIELD", message_vars: { label: label_var(next_field) } };
  }
  if (changed.includes("computed")) {
    return { message_key: "DCS_TRACK_COMPUTED_FIELD", message_vars: { label: label_var(next_field) } };
  }
  if (changed.includes("design")) {
    return { message_key: "DCS_TRACK_DESIGN_FIELD", message_vars: { label: label_var(next_field) } };
  }
  if (changed.some((name) => TEXT_KEYS.includes(name))) {
    return { message_key: "DCS_TRACK_TEXT_FIELD", message_vars: { label: label_var(next_field) } };
  }

  return { message_key: "DCS_TRACK_EDITED_FIELD", message_vars: { label: label_var(next_field) } };
}

export function describe_fields_change(previous_fields, next_fields) {
  const previous_map = fields_by_id(previous_fields);
  const next_map = fields_by_id(next_fields);

  const added = [...next_map.keys()].filter((id) => !previous_map.has(id));
  const removed = [...previous_map.keys()].filter((id) => !next_map.has(id));

  if (added.length === 1 && removed.length === 0) {
    const field = next_map.get(added[0]);
    return { message_key: "DCS_TRACK_ADDED_FIELD", message_vars: { type: type_label_var(field.type), label: label_var(field) }, field_ids: added };
  }
  if (added.length > 1 && removed.length === 0) {
    return { message_key: "DCS_TRACK_ADDED_FIELDS", message_vars: { count: added.length }, field_ids: added };
  }
  if (removed.length === 1 && added.length === 0) {
    const field = previous_map.get(removed[0]);
    return { message_key: "DCS_TRACK_DELETED_FIELD", message_vars: { type: type_label_var(field.type), label: label_var(field) }, field_ids: removed };
  }
  if (removed.length > 1 && added.length === 0) {
    return { message_key: "DCS_TRACK_DELETED_FIELDS", message_vars: { count: removed.length }, field_ids: removed };
  }
  if (added.length > 0 || removed.length > 0) {
    return {
      message_key: "DCS_TRACK_REPLACED_FIELDS",
      message_vars: { added: added.length, removed: removed.length },
      field_ids: added.concat(removed),
    };
  }

  // A group or section whose ONLY change is its own children list did not
  // itself get edited - one of the fields inside it did, and that field is
  // already in this list on its own. Counting the container too would
  // report every nested edit as "edited 2 fields".
  const edited_ids = [...next_map.keys()].filter((id) => {
    const previous_field = previous_map.get(id);
    const next_field = next_map.get(id);
    if (JSON.stringify(previous_field) === JSON.stringify(next_field)) return false;
    const changed = changed_keys(previous_field, next_field);
    return !(changed.length === 1 && changed[0] === "children");
  });

  if (edited_ids.length === 0) {
    if (top_level_order(previous_fields) === top_level_order(next_fields)) {
      return { message_key: "DCS_TRACK_EDITED_FORM", message_vars: {}, field_ids: [] };
    }
    const moved_id = (next_fields || []).map((field) => field.id).find((id, index) => (previous_fields || [])[index]?.id !== id);
    const moved_field = moved_id ? next_map.get(moved_id) : null;
    return moved_field
      ? { message_key: "DCS_TRACK_MOVED_FIELD", message_vars: { label: label_var(moved_field) }, field_ids: [moved_id] }
      : { message_key: "DCS_TRACK_REORDERED", message_vars: {}, field_ids: [] };
  }

  if (edited_ids.length === 1) {
    return Object.assign(single_field_record(previous_map.get(edited_ids[0]), next_map.get(edited_ids[0])), {
      field_ids: edited_ids,
    });
  }

  return { message_key: "DCS_TRACK_EDITED_FIELDS", message_vars: { count: edited_ids.length }, field_ids: edited_ids };
}
