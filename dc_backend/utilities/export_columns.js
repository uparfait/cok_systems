const NON_DATA_TYPES = ["section", "paragraph", "header", "file", "group", "image_block", "horizontal_line"];
const MEDIA_TYPES = ["image", "video", "audio", "file_upload", "signature"];

/**
 * Everything the Excel export of a form's responses needs to lay its
 * columns out and turn a stored answer into a cell: the active version's
 * fields first, then fields other versions had, then Version, Submitted
 * by and Submitted at - the same order as the data table.
 */
function sanitize_filename(name) {
  return (name || "export").replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
}

function get_field_text(label, language) {
  if (!label) return "";
  if (typeof label === "string") return label;
  return label[language] || label.kn || label.en || label.fr || Object.values(label)[0] || "";
}

function has_any_label(field) {
  return field.type === "geolocation" || ["en", "kn", "fr"].some((lang) => !!get_field_text(field.label, lang));
}

function flatten_fields(fields, accumulator) {
  const flat = accumulator || [];
  (fields || []).forEach((field) => {
    flat.push(field);
    if ((field.type === "group" || field.type === "section") && Array.isArray(field.children)) {
      flatten_fields(field.children, flat);
    }
  });
  return flat;
}

function collect_data_fields(version_doc) {
  return flatten_fields(version_doc.schema.fields).filter((field) => !NON_DATA_TYPES.includes(field.type));
}

const GEO_PARTS = ["latitude", "longitude", "accuracy"];

/**
 * The column(s) one field takes. A location field is written as exactly
 * three columns - "<label> latitude", "<label> longitude", "<label>
 * accuracy" - never its address or any other sub-field, the same three
 * the CSV headers template offers and the import maps, so an export can
 * be imported back as it is.
 */
function column_entries(field, language, translate) {
  const label = get_field_text(field.label, language) || (field.type === "geolocation" ? translate("DCS_GEO_TABLE_HEADER_LABEL", language) : "");
  if (field.type === "geolocation") {
    return GEO_PARTS.map((part) => ({ key: `${field.id}__${part}`, label: `${label} ${part}`, type: "number", field_id: field.id, part }));
  }
  return [{ key: field.id, label, type: field.type }];
}

/**
 * The export's columns for a form: { columns, field_type_by_id }. Columns
 * carry key, label and (for data fields) the field type.
 */
function build_diffed_columns(versions, language, translate) {
  const active_version_doc = versions.find((entry) => entry.is_active) || versions[0];
  if (!active_version_doc) return { columns: [], field_type_by_id: new Map() };

  const active_fields = collect_data_fields(active_version_doc);
  const active_field_ids = new Set(active_fields.map((field) => field.id));
  const removed_field_defs = [];
  const seen_removed_ids = new Set();

  versions
    .filter((entry) => entry.version !== active_version_doc.version)
    .forEach((version_doc) => {
      collect_data_fields(version_doc).forEach((field) => {
        if (!active_field_ids.has(field.id) && !seen_removed_ids.has(field.id)) {
          seen_removed_ids.add(field.id);
          removed_field_defs.push(field);
        }
      });
    });

  const field_type_by_id = new Map();
  active_fields.forEach((field) => field_type_by_id.set(field.id, field.type));
  removed_field_defs.forEach((field) => field_type_by_id.set(field.id, field.type));

  const columns = [
    // First, and deliberately: the export and the feed send one line per
    // RECORD, and on a tracked form a record that was corrected is sent
    // again on the next ?since pull. Without a stable key a reader would
    // append that correction as a second car instead of replacing the
    // line it already has.
    { key: "record_id", label: translate("TABLE_RECORD_ID", language), type: "id" },
    ...active_fields.filter(has_any_label).flatMap((field) => column_entries(field, language, translate)),
    ...removed_field_defs.filter(has_any_label).flatMap((field) => column_entries(field, language, translate)),
    { key: "version", label: translate("TABLE_VERSION", language) },
    { key: "submitted_by", label: translate("TABLE_SUBMITTED_BY", language) },
    { key: "submitted_at", label: translate("TABLE_SUBMITTED_AT", language) },
  ];
  return { columns, field_type_by_id };
}

/** An uploaded file's stored path made absolute against the site the viewer uses. */
function absolute_url(url, origin) {
  if (typeof url !== "string" || !url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${origin || ""}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * One stored answer as an Excel cell: arrays joined, a file answer as its
 * full address, a location as "lat, lng - address", anything else as text.
 */
function format_cell(raw_value, field_type, origin) {
  if (raw_value === null || raw_value === undefined) return "";
  if (Array.isArray(raw_value)) return raw_value.join(", ");
  if (typeof raw_value !== "object") return String(raw_value);
  if (raw_value.__map__location__data === true) {
    if (raw_value.latitude === null || raw_value.latitude === undefined) return "";
    const point = `${raw_value.latitude}, ${raw_value.longitude}`;
    return raw_value.full_address ? `${point} - ${raw_value.full_address}` : point;
  }
  if (typeof raw_value.url === "string" && (MEDIA_TYPES.includes(field_type) || raw_value.name !== undefined)) {
    return absolute_url(raw_value.url, origin);
  }
  return JSON.stringify(raw_value);
}

/**
 * The cell one data column takes from a submission's answers: a location
 * part column reads its number straight off the stored location (typed,
 * so a spreadsheet sums and maps it), any other column goes through
 * format_cell.
 */
function column_cell(data, column, field_type_by_id, origin) {
  const values = data || {};
  if (column.part) {
    const raw = values[column.field_id];
    if (!raw || typeof raw !== "object" || raw.__map__location__data !== true) return "";
    const part = raw[column.part];
    return typeof part === "number" && Number.isFinite(part) ? part : part === null || part === undefined || part === "" ? "" : Number(part) || "";
  }
  return format_cell(values[column.key], field_type_by_id.get(column.key), origin);
}

module.exports = {
  NON_DATA_TYPES,
  MEDIA_TYPES,
  GEO_PARTS,
  column_cell,
  sanitize_filename,
  get_field_text,
  has_any_label,
  flatten_fields,
  collect_data_fields,
  build_diffed_columns,
  absolute_url,
  format_cell,
};
