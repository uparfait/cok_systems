const ExcelJS = require("exceljs");
const submissions_model = require("../../models/submissions_model.js");
const forms_model = require("../../models/forms_model.js");
const project_access = require("../../utilities/project_access.js");
const { resolve_period_bounds } = require("../../utilities/period_bounds.js");
const { warning_response, error_response } = require("../../utilities/response.js");
const { translate } = require("../../i18n/index.js");
const { format_respondent } = require("../../utilities/respondent.js");
const { resolve_client_origin } = require("../../utilities/approval_email.js");
const { build_diffed_columns, format_cell, sanitize_filename } = require("../../utilities/export_columns.js");
const { is_enabled: is_tracking_enabled } = require("../../utilities/tracking.js");

const EXPORT_PAGE_SIZE = 500;

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
    // Nothing picked means English: a data file usually leaves the
    // building, and English is the one everybody downstream can read.
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

    const { columns: data_columns, field_type_by_id } = build_diffed_columns(versions, lang, translate);
    const origin = resolve_client_origin(req);

    // The same reading the background export uses: the records that have a
    // stage inside the range, ONE line each, every tracked field carrying
    // the value it held at the range's end. Deliberately not the table's
    // stage-by-stage rows - the same plate on several lines of a
    // spreadsheet reads as duplicated data to whoever opens it.
    const active_version = versions.find((entry) => entry.is_active) || versions[0];
    const tracking = active_version && is_tracking_enabled(active_version.tracking) ? active_version.tracking : null;

    const all_items = await submissions_model.stream_in_range(form_group_id, bounds, tracking, EXPORT_PAGE_SIZE).toArray();

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
          row_data[field_id] = format_cell(submission.data ? submission.data[field_id] : undefined, field_type, origin);
        });
        row_data["record_id"] = submission._id ? submission._id.toString() : "";
        row_data["version"] = submission.version || "";
        row_data["submitted_by"] = format_respondent(submission.respondent);
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
