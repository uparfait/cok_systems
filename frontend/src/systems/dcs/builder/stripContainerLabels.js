const CONTAINER_TYPES = ["group", "section"];

/**
 * Any language at all carrying text - checked directly rather than through
 * a display lookup, since a label authored only in Kinyarwanda is still a
 * label that has to come off.
 */
function has_any_label_text(label) {
  if (!label) return false;
  if (typeof label === "string") return label.trim().length > 0;
  if (typeof label !== "object") return false;
  return Object.values(label).some((value) => typeof value === "string" && value.trim().length > 0);
}

/**
 * Strips the label off every group and section in the form.
 *
 * A container asks nothing, so a label on one renders to the respondent as
 * a question with no answer - which is why neither type shows a label any
 * more. But a label can still ARRIVE on one: pasted through the code
 * overlay, imported from a template, or left behind on a form authored
 * before the rule existed. Rather than quietly rendering it nowhere and
 * leaving it in the schema to confuse whoever reads the JSON next, it is
 * taken out of the form and the author is told it happened.
 *
 * Returns the same array reference when there was nothing to strip, so a
 * caller can use that to decide whether anything needs saving at all.
 */
export function strip_container_labels(fields) {
  const stripped_ids = [];

  const walk = (field_list) => {
    let changed = false;
    const next_list = (field_list || []).map((field) => {
      if (!field) return field;

      let next_field = field;

      if (CONTAINER_TYPES.includes(field.type) && has_any_label_text(field.label)) {
        next_field = Object.assign({}, next_field);
        delete next_field.label;
        stripped_ids.push(field.id);
        changed = true;
      }

      if (Array.isArray(field.children)) {
        const child_result = walk(field.children);
        if (child_result.changed) {
          next_field = Object.assign({}, next_field, { children: child_result.fields });
          changed = true;
        }
      }

      return next_field;
    });

    return { fields: changed ? next_list : field_list, changed };
  };

  const result = walk(fields);
  return { fields: result.fields, stripped_ids, stripped_count: stripped_ids.length };
}
