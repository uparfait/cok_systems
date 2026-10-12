const ExcelJS = require("exceljs");
const location_levels = require("./location_levels.js");
const { translate } = require("../i18n/index.js");

/**
 * The Excel headers template: a "Data" sheet with the one header row, and
 * a visible "Options" sheet listing, one column per choice field, the
 * values a cell may hold (option labels in the template's language, the
 * country's locations for an API-sourced cascading field, 1..N for a
 * scale, Yes/No). Every single-choice column of the Data sheet gets a
 * list validation over rows 2 to 2001 pointing at its Options column -
 * never an inline list, which Excel caps at 255 characters. A multi
 * choice column (several values in one cell) is listed but not
 * validated. Locations that cannot be read leave their column out; the
 * template is still produced.
 */
const LAST_ROW = 2001;
const SINGLE_CHOICE_TYPES = ["single_select", "select_group", "cascading_select", "likert_scale", "boolean", "yes_no"];
const MULTI_CHOICE_TYPES = ["multi_select", "ranking"];
const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF056DAA" } };

function column_letter(index) {
  let number = index + 1;
  let letters = "";
  while (number > 0) {
    const remainder = (number - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    number = Math.floor((number - 1) / 26);
  }
  return letters;
}

/** What one field's cell may hold, as the dropdown shows it; [] when the field has no fixed choices. */
function template_options(field, language) {
  if (field.type === "likert_scale") return Array.from({ length: Number(field.scale_size) || 5 }, (_, index) => String(index + 1));
  if (field.type === "boolean" || field.type === "yes_no") return [translate("IMPORT_OPTION_YES", language), translate("IMPORT_OPTION_NO", language)];
  if (field.api_sourced) {
    try {
      return location_levels.location_labels_at_level(field.level || "provinces", language);
    } catch (error) {
      return [];
    }
  }
  if (!SINGLE_CHOICE_TYPES.includes(field.type) && !MULTI_CHOICE_TYPES.includes(field.type)) return [];
  return (field.options || []).map((option) => String(option.label === undefined || option.label === null || option.label === "" ? option.value : option.label));
}

function style_header(row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.alignment = { horizontal: "center", vertical: "middle" };
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
  });
}

/**
 * fields: the fillable field views (in header order; a location takes
 * three headers). Returns the workbook as a Buffer.
 */
async function build_xlsx_template(headers, fields, language) {
  const workbook = new ExcelJS.Workbook();
  const data = workbook.addWorksheet("Data");
  data.columns = headers.map((header, index) => ({ key: `c${index}`, width: 22 }));
  style_header(data.addRow(headers));

  const listed = [];
  let column = 0;
  fields.forEach((field) => {
    const options = template_options(field, language);
    if (options.length > 0) listed.push({ field, options, column, validate: SINGLE_CHOICE_TYPES.includes(field.type) });
    column += field.type === "geolocation" ? 3 : 1;
  });
  if (listed.length === 0) return Buffer.from(await workbook.xlsx.writeBuffer());

  const sheet = workbook.addWorksheet("Options");
  sheet.columns = listed.map((entry, index) => ({ key: `o${index}`, width: 28 }));
  style_header(sheet.addRow(listed.map((entry) => entry.field.label)));
  const longest = Math.max(...listed.map((entry) => entry.options.length));
  for (let row = 0; row < longest; row += 1) sheet.addRow(listed.map((entry) => (row < entry.options.length ? entry.options[row] : null)));

  listed.forEach((entry, index) => {
    if (!entry.validate) return;
    const letter = column_letter(entry.column);
    const source = column_letter(index);
    data.dataValidations.add(`${letter}2:${letter}${LAST_ROW}`, {
      type: "list",
      allowBlank: true,
      formulae: [`Options!$${source}$2:$${source}$${entry.options.length + 1}`],
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: entry.field.label,
      error: translate("IMPORT_TEMPLATE_PICK_FROM_LIST", language),
    });
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = { LAST_ROW, SINGLE_CHOICE_TYPES, MULTI_CHOICE_TYPES, column_letter, template_options, build_xlsx_template };
