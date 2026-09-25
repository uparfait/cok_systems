const { PERIOD_PRESETS, TABLE_MODES, TABLE_LIMITS, SORT_DIRECTIONS, TEXT_ALIGNS, TEXT_SIZES, TEXT_LIMITS, MAX_PINNED_FIELDS, SUBMITTED_AT_FIELD } = require("./constants.js");

/**
 * The sanitizers of the widget keys added for report-style boards: a
 * widget's own time window and whether it is locked to it, the board
 * filters it refuses to follow, a text block's words, and a table's
 * settings. Kept beside sanitize.js so that file stays readable; every
 * function here reduces what a client sent to exactly the keys the
 * dashboard understands, and nothing else is ever stored.
 */

const clean_string = (value) => (typeof value === "string" ? value.trim() : "");
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const is_scalar = (value) => ["string", "number", "boolean"].includes(typeof value);

/**
 * A widget's own period. `locked: true` means the widget ALWAYS reads this
 * window: the board's date filter passes it by. Without a preset there is
 * no period at all (the widget follows the board), whatever else was sent.
 */
function sanitize_period(raw) {
  if (!raw || typeof raw !== "object") return null;
  const preset = clean_string(raw.preset);
  if (!preset) return null;
  const period = { preset, from: clean_string(raw.from) || null, to: clean_string(raw.to) || null };
  if (raw.locked === true) period.locked = true;
  return period;
}

/** The board filter fields this widget does not follow, deduplicated and capped. */
function sanitize_pinned_fields(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  raw.forEach((entry) => {
    const field_id = clean_string(entry && typeof entry === "object" ? entry.field_id : entry);
    if (!field_id || seen.has(field_id) || out.length >= MAX_PINNED_FIELDS) return;
    seen.add(field_id);
    out.push(field_id);
  });
  return out;
}

/**
 * A text block's words. The body is kept as typed apart from trailing
 * blanks, because its blank lines are its paragraphs and its markup
 * (**bold**, ==highlight==) is read by the card, never by the server.
 */
function sanitize_text(widget) {
  if (clean_string(widget.chart_type) !== "text") return null;
  const raw = widget.text && typeof widget.text === "object" ? widget.text : {};
  const out = {
    heading: clean_string(raw.heading).slice(0, TEXT_LIMITS.MAX_HEADING),
    body: typeof raw.body === "string" ? raw.body.replace(/\s+$/, "").slice(0, TEXT_LIMITS.MAX_BODY) : "",
    align: TEXT_ALIGNS.includes(clean_string(raw.align)) ? clean_string(raw.align) : "left",
    size: TEXT_SIZES.includes(clean_string(raw.size)) ? clean_string(raw.size) : "md",
  };
  if (HEX_COLOR.test(clean_string(raw.accent))) out.accent = clean_string(raw.accent).toLowerCase();
  return out;
}

/** One measure column of a summary table: what it computes, on what, under which filters. */
function sanitize_column(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const aggregation = clean_string(raw.aggregation) || "count";
  const column = {
    key: clean_string(raw.key) || `c${index + 1}`,
    label: clean_string(raw.label).slice(0, TABLE_LIMITS.MAX_COLUMN_LABEL),
    aggregation,
    field_id: clean_string(raw.field_id) || null,
    filters: Array.isArray(raw.filters)
      ? raw.filters
          .filter((filter) => filter && typeof filter === "object")
          .map((filter) => ({ field_id: clean_string(filter.field_id), operator: clean_string(filter.operator), value: is_scalar(filter.value) ? filter.value : "" }))
      : [],
  };
  return column;
}

/**
 * A table's settings. A RECORDS table keeps the fields it shows, its page
 * size (held between ten and a hundred), how it is sorted and - only on a
 * data request, never worth saving - which page is wanted. A SUMMARY table
 * keeps its measure columns and which totals it draws.
 */
function sanitize_table(widget) {
  if (clean_string(widget.chart_type) !== "table") return null;
  const raw = widget.table && typeof widget.table === "object" ? widget.table : {};
  const mode = TABLE_MODES.includes(clean_string(raw.mode)) ? clean_string(raw.mode) : "records";
  const out = { mode };
  if (mode === "records") {
    const seen = new Set();
    out.fields = (Array.isArray(raw.fields) ? raw.fields : [])
      .map((id) => clean_string(id))
      .filter((id) => {
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, TABLE_LIMITS.MAX_FIELDS);
    const page_size = Number(raw.page_size);
    out.page_size = Number.isFinite(page_size) ? Math.min(TABLE_LIMITS.MAX_PAGE_SIZE, Math.max(TABLE_LIMITS.MIN_PAGE_SIZE, Math.round(page_size))) : TABLE_LIMITS.DEFAULT_PAGE_SIZE;
    const page = Number(raw.page);
    if (Number.isFinite(page) && page > 1) out.page = Math.round(page);
    const sort = raw.sort && typeof raw.sort === "object" ? raw.sort : {};
    out.sort = { field_id: clean_string(sort.field_id) || SUBMITTED_AT_FIELD, direction: SORT_DIRECTIONS.includes(clean_string(sort.direction)) ? clean_string(sort.direction) : "desc" };
    if (raw.show_submitted_at === false) out.show_submitted_at = false;
    return out;
  }
  out.columns = (Array.isArray(raw.columns) ? raw.columns : []).map(sanitize_column).filter(Boolean).slice(0, TABLE_LIMITS.MAX_COLUMNS);
  const totals = raw.totals && typeof raw.totals === "object" ? raw.totals : {};
  out.totals = { row: totals.row !== false, column: totals.column === true };
  return out;
}

/** Whether a preset is one the period filter knows - used by the validator too. */
const is_known_preset = (preset) => PERIOD_PRESETS.includes(preset);

module.exports = {
  sanitize_period,
  sanitize_pinned_fields,
  sanitize_text,
  sanitize_table,
  is_known_preset,
};
