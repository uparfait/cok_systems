const SEARCHABLE_TEXT_KEYS = ["label", "help_text", "placeholder", "valid_message", "content", "text", "low_label", "high_label"];

/**
 * Every language of a translated-text value, flattened - an author looking
 * for a question types it in whichever language they wrote it in, which is
 * not necessarily the one the builder is currently displaying.
 */
function translated_values(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (typeof value === "object") return Object.values(value).filter((entry) => typeof entry === "string");
  return [];
}

/**
 * Everything about one field a search should look inside: its wording in
 * every language, the options it offers, and its own id and type - so a
 * field can be found by what it asks, by an answer it accepts, or by what
 * kind of question it is.
 */
function field_haystack(field) {
  const parts = [String(field.id || ""), String(field.type || "")];

  SEARCHABLE_TEXT_KEYS.forEach((key) => {
    parts.push(...translated_values(field[key]));
  });

  (field.options || []).forEach((option) => {
    parts.push(...translated_values(option.label));
    if (option.value) parts.push(String(option.value));
  });

  (field.parent_option_groups || []).forEach((group) => {
    (group.options || []).forEach((option) => {
      parts.push(...translated_values(option.label));
      if (option.value) parts.push(String(option.value));
    });
  });

  return parts.join(" ").toLowerCase();
}

export function field_matches_query(field, query) {
  if (!field || !query) return false;
  return field_haystack(field).includes(query.trim().toLowerCase());
}

/**
 * The ids worth keeping on screen for this query: every field that matches
 * itself, plus every group or section on the way down to one. A container
 * has to survive the filter even when it does not match, or the child that
 * does would have nowhere to be shown.
 */
export function collect_search_matches(fields, query) {
  const trimmed = (query || "").trim();
  const matched = new Set();
  const visible = new Set();
  if (!trimmed) return { matched, visible, count: 0 };

  const mark_subtree_visible = (field_list) => {
    (field_list || []).forEach((field) => {
      if (!field) return;
      visible.add(field.id);
      if (Array.isArray(field.children)) mark_subtree_visible(field.children);
    });
  };

  const walk = (field_list) => {
    let any_matched_below = false;
    (field_list || []).forEach((field) => {
      if (!field) return;
      const self_matched = field_matches_query(field, trimmed);
      const matched_in_children = Array.isArray(field.children) ? walk(field.children) : false;

      if (self_matched) matched.add(field.id);
      if (self_matched || matched_in_children) {
        visible.add(field.id);
        any_matched_below = true;
      }
      // A group found by its OWN name is being looked for as a whole, so
      // it keeps all of its children - showing the group emptied of the
      // questions it exists to hold would answer the search with nothing.
      if (self_matched && Array.isArray(field.children)) mark_subtree_visible(field.children);
    });
    return any_matched_below;
  };

  walk(fields);
  return { matched, visible, count: matched.size };
}
