const ExcelJS = require("exceljs");
const submissions_model = require("../../models/submissions_model.js");
const forms_model = require("../../models/forms_model.js");
const project_access = require("../../utilities/project_access.js");
const { resolve_period_bounds } = require("../../utilities/period_bounds.js");
const { warning_response, error_response } = require("../../utilities/response.js");

const EXPORT_PAGE_SIZE = 500;

const NON_DATA_TYPES = ["section", "paragraph", "header", "file", "group", "image_block", "horizontal_line"];

function sanitize_filename(name) {
  return (name || "export").replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
}

function get_field_text_localized(label, language) {
  if (!label) return "";
  if (typeof label === "string") return label;
  return label[language] || label.en || label.kn || label.fr || Object.values(label)[0] || "";
}

function flatten_fields(fields, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 50) return [];
  const result = [];
  for (const field of fields || []) {
    if (!field || typeof field !== "object") continue;
    result.push(field);
    if (field.type === "group" && Array.isArray(field.fields)) {
      result.push(...flatten_fields(field.fields, depth + 1));
    }
  }
  return result;
}

/**
 * Generates and streams an Excel file of all submissions for a form within
 * an optional date range. The entire export runs server-side: data is
 * fetched in batches, the workbook is built, and the .xlsx binary is sent
 * as a download attachment.
 */
async function export_submissions(req, res) {
  try {
    const { form_group_id } = req.params;
    const { period = "all", from, to, title, language } = req.query || {};
    const lang = language || "en";

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

    const all_field_defs = new Map();
    versions.forEach((version_doc) => {
      flatten_fields(version_doc.schema.fields).forEach((field) => {
        if (!NON_DATA_TYPES.includes(field.type) && !all_field_defs.has(field.id)) {
          all_field_defs.set(field.id, field);
        }
      });
    });
    const data_fields = [...all_field_defs.values()];

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

    if (all_items.length === 0) {
      return res.status(404).json(warning_response(req, "NO_DATA_TO_EXPORT"));
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Data");

    const headers = [
      ...data_fields.map((field) => get_field_text_localized(field.label, lang) || field.id),
      "Version",
      "Submitted At",
    ];

    sheet.columns = headers.map((header) => ({ header: String(header), key: String(header), width: 20 }));
    sheet.getRow(1).font = { bold: true };

    for (const submission of all_items) {
      const row_data = {};
      data_fields.forEach((field) => {
        const raw_value = submission.data ? submission.data[field.id] : undefined;
        const col_name = get_field_text_localized(field.label, lang) || field.id;
        if (Array.isArray(raw_value)) {
          row_data[col_name] = raw_value.join(", ");
        } else if (raw_value != null && typeof raw_value === "object") {
          row_data[col_name] = JSON.stringify(raw_value);
        } else {
          row_data[col_name] = raw_value != null ? String(raw_value) : "";
        }
      });
      row_data["Version"] = submission.version || "";
      row_data["Submitted At"] = submission.submitted_at ? new Date(submission.submitted_at).toISOString() : "";
      sheet.addRow(row_data);
    }

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
