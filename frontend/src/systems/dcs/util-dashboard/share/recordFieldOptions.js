import { flatten_schema_fields, field_label_text } from "../chartCatalog.js";
import { get_field_text } from "../../fields/fieldText.js";

/**
 * The fields a records table can ever show, across every version of the
 * form - the same list the server builds for that table: the active
 * version's own fields in its order, then the fields only older versions
 * carry (records submitted back then still answer them, so their answers
 * still appear). A share link's owner picks from this list which of them
 * its viewers may see.
 */

const NON_DATA_TYPES = ["section", "paragraph", "header", "file", "group", "image_block", "horizontal_line"];

const data_fields = (version) => flatten_schema_fields((version && version.schema && version.schema.fields) || []).filter((field) => field && field.id && !NON_DATA_TYPES.includes(field.type));

export function record_field_options(versions, language) {
  const list = Array.isArray(versions) ? versions : [];
  const active = list.find((entry) => entry.is_active) || list[0];
  if (!active) return [];
  const ordered = [active].concat(list.filter((entry) => entry.version !== active.version));
  const seen = new Set();
  const options = [];
  ordered.forEach((version) => {
    data_fields(version).forEach((field) => {
      if (seen.has(field.id)) return;
      seen.add(field.id);
      options.push({
        id: field.id,
        label: get_field_text(field.label, language) || field_label_text(field),
        // A field the active version no longer asks: only older records answer it.
        retired: version.version !== active.version,
      });
    });
  });
  return options;
}
