import ExcelJS from "exceljs";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { get_field_text } from "../fields/fieldText.js";
import { format_respondent } from "./respondentStore.js";

// A media answer's real value is {name, type, size, url} - the file
// itself lives on disk, not in this export - so only the filename (or a
// generic placeholder) is exported for those.
function stringify_export_cell(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return value.name || "file";
  return String(value);
}

/**
 * Downloads the device's ready-to-send records of one form as an Excel
 * sheet: the question texts as headers, one row per record, the moment it
 * was saved and who saved it first.
 */
export async function export_ready_records(form, ready_records, language) {
  const fields_by_id = new Map(flatten_fields(form.schema.fields).map((field) => [field.id, field]));
  const field_ids = [...new Set(ready_records.flatMap((record) => Object.keys(record.data || {})))];
  const header_labels = ["Saved at", "Submitted by"].concat(
    field_ids.map((field_id) => {
      const field = fields_by_id.get(field_id);
      return (field && get_field_text(field.label, language)) || field_id;
    }),
  );

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Submissions");
  worksheet.columns = header_labels.map(() => ({ width: 26 }));

  // The header row is the actual question text, highlighted so it reads
  // as a label at a glance rather than a bare column key.
  const header_row = worksheet.getRow(1);
  header_labels.forEach((label_text, index) => {
    const cell = header_row.getCell(index + 1);
    cell.value = label_text;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF056DAA" } };
  });

  ready_records.forEach((record, row_index) => {
    const row = worksheet.getRow(row_index + 2);
    row.getCell(1).value = record.created_at ? new Date(record.created_at).toLocaleString() : "";
    row.getCell(2).value = format_respondent(record.respondent);
    field_ids.forEach((field_id, column_index) => {
      row.getCell(column_index + 3).value = stringify_export_cell(record.data ? record.data[field_id] : undefined);
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dcs_ready_submissions_${Date.now()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
