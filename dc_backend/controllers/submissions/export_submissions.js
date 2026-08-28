const ExcelJS = require("exceljs");
const submissions_model = require("../../models/submissions_model.js");
const forms_model = require("../../models/forms_model.js");
const project_access = require("../../utilities/project_access.js");
const { resolve_period_bounds } = require("../../utilities/period_bounds.js");
const { warning_response, error_response } = require("../../utilities/response.js");
const { translate } = require("../../i18n/index.js");

const EXPORT_PAGE_SIZE = 500;

const NON_DATA_TYPES = ["section", "paragraph", "header", "file", "group", "image_block", "horizontal_line"];

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

function build_column_entry(field, language) {
  const label = get_field_text(field.label, language) || (field.type === "geolocation" ? translate("DCS_GEO_TABLE_HEADER_LABEL", language) : "");
  return { key: field.id, label };
}

function build_diffed_columns(versions, language) {
  const active_version_doc = versions.find((entry) => entry.is_active) || versions[0];
  if (!active_version_doc) return { columns: [], field_type_by_id: new Map() };

  const active_fields = collect_data_fields(active_version_doc);
  const active_field_ids = new Set(active_fields.map((field) => field.id));

  if (versions.length <= 1) {
    return {
      columns: [
        ...active_fields.filter(has_any_label).map((field) => build_column_entry(field, language)),
        { key: "version", label: translate("TABLE_VERSION", language) },
        { key: "submitted_at", label: translate("TABLE_SUBMITTED_AT", language) },
      ],
      field_type_by_id: new Map(active_fields.map((field) => [field.id, field.type])),
    };
  }

  const other_versions = versions.filter((entry) => entry.version !== active_version_doc.version);
  const field_ids_in_other_versions = new Set();
  const removed_field_defs = [];
  const seen_removed_ids = new Set();

  other_versions.forEach((version_doc) => {
    collect_data_fields(version_doc).forEach((field) => {
      field_ids_in_other_versions.add(field.id);
      if (!active_field_ids.has(field.id) && !seen_removed_ids.has(field.id)) {
        seen_removed_ids.add(field.id);
        removed_field_defs.push(field);
      }
    });
  });

  const field_type_by_id = new Map();
  active_fields.forEach((field) => field_type_by_id.set(field.id, field.type));
  removed_field_defs.forEach((field) => field_type_by_id.set(field.id, field.type));

  const active_columns = active_fields
    .filter(has_any_label)
    .map((field) => build_column_entry(field, language));
  const removed_columns = removed_field_defs.filter(has_any_label).map((field) => build_column_entry(field, language));

  const columns = [
    ...active_columns,
    ...removed_columns,
    { key: "version", label: translate("TABLE_VERSION", language) },
    { key: "submitted_at", label: translate("TABLE_SUBMITTED_AT", language) },
  ];

  return { columns, field_type_by_id };
}

/**
 * Generates and streams an Excel file of all submissions for a form within
 * an optional date range. The entire export runs server-side: data is
 * fetched in batches, the workbook is built, and the .xlsx binary is sent
 * as a download attachment. Column headers mirror the table on the form
 * data page exactly - the active version's fields followed by fields that
 * existed in other versions but not the active one, then Version and
 * Submitted At. Headers are always included even when there is no data.
 */
async function export_submissions(req, res) {
  try {
    const { form_group_id } = req.params;
    const { period = "all", from, to, title, language } = req.query || {};
    const lang = language || req.language || "kn";

    if (!form_group_id) {
      return res.status(400).json(warning_response(req, "FORM_ID_REQUIRED"));
    }

    const access = await project_access.can_view_form_group(req.user, form_group_id);
    if (access.found && !access.allowed) {
      return res.status(403).json(warning_response(req, "ACCESS_DENIED"));
    }

    const bounds = resolve_period_bounds(period, from, to);
    if (bounds === undefined) {
      return res.status(400).json(warning_response(req, "VALIDATION_FAILED"));
    }

    const versions = await forms_model.get_versions_by_group(form_group_id);
    if (!versions || versions.length === 0) {
      return res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    }

    const { columns: data_columns, field_type_by_id } = build_diffed_columns(versions, lang);

    const all_items = [];
    let page = 1;
    let total = 0;

    while (true) {
      const result = await submissions_model.list_submissions(form_group_id, undefined, page, EXPORT_PAGE_SIZE, bounds, { sort: "oldest" });
      if (page === 1) total = result.total;
      if (!result.items || result.items.length === 0) break;
      all_items.push(...result.items);
      if (all_items.length >= total || result.items.length < EXPORT_PAGE_SIZE) break;
      page += 1;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Data");

    if (title) {
      const title_row = sheet.addRow([title]);
      title_row.font = { bold: true, size: 14, color: { argb: "FF056DAA" } };
      title_row.alignment = { horizontal: "left" };
      sheet.addRow([]);
    }

    const headers = data_columns.map((column) => column.label);
    const header_row = sheet.addRow(headers);
    header_row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header_row.alignment = { horizontal: "center", vertical: "middle" };
    header_row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF056DAA" } };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });

    sheet.columns = data_columns.map((column) => ({ key: column.key, width: 22 }));

    if (all_items.length === 0) {
      const no_data_row = sheet.addRow([translate("NO_DATA_TO_EXPORT", lang)]);
      no_data_row.font = { italic: true, color: { argb: "FF999999" } };
    } else {
      for (const submission of all_items) {
        const row_data = {};
        field_type_by_id.forEach((field_type, field_id) => {
          const raw_value = submission.data ? submission.data[field_id] : undefined;
          if (Array.isArray(raw_value)) {
            row_data[field_id] = raw_value.join(", ");
          } else if (raw_value != null && typeof raw_value === "object") {
            row_data[field_id] = JSON.stringify(raw_value);
          } else {
            row_data[field_id] = raw_value != null ? String(raw_value) : "";
          }
        });
        row_data["version"] = submission.version || "";
        row_data["submitted_at"] = submission.submitted_at ? new Date(submission.submitted_at).toISOString() : "";
        sheet.addRow(row_data);
      }
    }

    const total_row = sheet.addRow([]);
    const total_label = translate("TABLE_TOTAL", lang);
    const total_row_data = { [data_columns[0].key]: `${total_label}: ${all_items.length}` };
    const total_excel_row = sheet.addRow(total_row_data);
    total_excel_row.font = { bold: true, size: 10, color: { argb: "FF056DAA" } };

    const buffer = await workbook.xlsx.writeBuffer();

    const filename = sanitize_filename(title || "export") + ".xlsx";
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("X-Total-Records", all_items.length);
    return res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = export_submissions;
