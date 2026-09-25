/**
 * Runs every disaster board through the SAME server-side checks a paste
 * goes through: sanitize, validate_dashboard against the DMIS form's real
 * schema, and validate_filter_defs for the board filters - plus a scan for
 * field ids the form does not have. No database is needed.
 *
 *   node validate_boards.js            (from this folder)
 *
 * Writes logs/validate_boards.log and exits non-zero on the first board
 * that fails, so a broken file can never be mistaken for a checked one.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const BACKEND = path.join(ROOT, "dc_backend", "util-dashboard");
const { sanitize_widgets } = require(path.join(BACKEND, "sanitize.js"));
const { validate_dashboard } = require(path.join(BACKEND, "widget_validation.js"));
const { build_field_catalog } = require(path.join(BACKEND, "field_catalog.js"));
const { sanitize_filter_defs, validate_filter_defs } = require(path.join(BACKEND, "board_filters.js"));

const FORM = "ef2401f3-f5ab-4e0e-a02a-ec28e2e76ebd";
const PROJECT = "6aa1be687372ebbcef6e11f2";
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "DMIS_Assessment_Form.json"), "utf8"));
const form_version = { form_group_id: FORM, project_id: PROJECT, version: 1, is_active: true, tracking: null, schema };
const versions = new Map([[FORM, form_version]]);
const catalog = build_field_catalog(schema);

const lines = [];
const say = (text) => {
  lines.push(text);
  console.log(text);
};

/** Every field id a widget names anywhere, for the unknown-field scan. */
function field_ids_of(widget) {
  const ids = [];
  const ref = (entry) => entry && entry.field_id && ids.push(entry.field_id);
  ref(widget.group_by);
  ref(widget.split_by);
  ref(widget.pattern_by);
  ref(widget.legend_by);
  if (widget.metric && widget.metric.field_id) ids.push(widget.metric.field_id);
  (widget.filters || []).forEach(ref);
  (widget.pinned_fields || []).forEach((id) => ids.push(id));
  const table = widget.table || {};
  (table.fields || []).forEach((id) => ids.push(id));
  (table.columns || []).forEach((column) => {
    if (column.field_id) ids.push(column.field_id);
    (column.filters || []).forEach(ref);
  });
  return ids;
}

say(`# disaster boards validation - ${new Date().toISOString()}`);
say(`# form ${FORM}, ${catalog.fields_by_id.size} fields in DMIS_Assessment_Form.json`);
let failed = false;
let total_widgets = 0;
const files = fs.readdirSync(__dirname).filter((name) => name.endsWith(".json")).sort();
files.forEach((file) => {
  const document = JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf8"));
  const widgets = sanitize_widgets(document.widgets).map((widget) => Object.assign(widget, { form_group_id: FORM }));
  const check = validate_dashboard(widgets, versions, PROJECT);
  const filters = sanitize_filter_defs(document.filters);
  const filter_errors = validate_filter_defs(filters, catalog);
  const unknown = new Set();
  widgets.forEach((widget) => field_ids_of(widget).forEach((id) => {
    if (!catalog.fields_by_id.has(id)) unknown.add(id);
  }));
  const kinds = {};
  widgets.forEach((widget) => {
    kinds[widget.chart_type] = (kinds[widget.chart_type] || 0) + 1;
  });
  const ok = check.valid && filter_errors.length === 0 && unknown.size === 0;
  say(`${ok ? "OK  " : "FAIL"} ${file}: ${widgets.length} widgets (${Object.entries(kinds).map(([kind, count]) => `${kind} ${count}`).join(", ")}), ${filters.length} board filters`);
  check.errors.forEach((error) => say(`      widget error: ${error}`));
  filter_errors.forEach((error) => say(`      filter error: ${error}`));
  if (unknown.size > 0) say(`      unknown fields: ${Array.from(unknown).join(", ")}`);
  if (!ok) failed = true;
  total_widgets += widgets.length;
});
say(`# ${files.length} boards, ${total_widgets} widgets, ${failed ? "FAILED" : "0 errors"}`);
fs.mkdirSync(path.join(__dirname, "logs"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "logs", "validate_boards.log"), lines.join("\n") + "\n");
process.exit(failed ? 1 : 0);
