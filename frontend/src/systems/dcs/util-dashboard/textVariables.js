/**
 * The LIVE FIGURES a text block may carry, the frontend half (the server
 * computes them in dc_backend/util-dashboard/text_data.js):
 *
 *   {{count}}  {{count(field)}}  {{count(field = value)}}
 *   {{sum(field)}} {{avg(field)}} {{min(field)}} {{max(field)}}
 *   {{count_distinct(field)}}  {{share(field = value)}}
 *   any of them narrowed with "| other_field = value"
 *
 * Here: which formulas exist, whether a block carries any (only then is it
 * fetched), how a token is written from the composer's choices, and how a
 * computed figure is shown in the text.
 */

export const TEXT_FORMULAS = ["count", "count_distinct", "sum", "avg", "min", "max", "share"];
export const VARIABLE_PATTERN = /\{\{\s*([a-z_]+)\s*(?:\(([^{}()]*)\))?\s*\}\}/g;

export const FORMULA_LABEL_KEYS = {
  count: "DCS_DB_F_COUNT",
  count_distinct: "DCS_DB_F_COUNT_DISTINCT",
  sum: "DCS_DB_F_SUM",
  avg: "DCS_DB_F_AVG",
  min: "DCS_DB_F_MIN",
  max: "DCS_DB_F_MAX",
  share: "DCS_DB_F_SHARE",
};

/** Whether this text block asks for any figure at all. */
export function has_text_variables(widget) {
  if (!widget || widget.chart_type !== "text") return false;
  const body = String((widget.text && widget.text.body) || "");
  return body.includes("{{") && new RegExp(VARIABLE_PATTERN.source, "g").test(body);
}

/** A value written into a token: quoted when it holds a space or a special character. */
const written_value = (value) => {
  const text = String(value === undefined || value === null ? "" : value).trim();
  return /^[A-Za-z0-9_.-]+$/.test(text) ? text : `"${text.replace(/"/g, "")}"`;
};

/** The token the composer's choices become. */
export function variable_token(formula, field_id, value, condition_field, condition_value) {
  const parts = [];
  if (field_id) parts.push(value !== undefined && value !== null && String(value).trim() !== "" ? `${field_id} = ${written_value(value)}` : field_id);
  const inside = parts.join("");
  const where = condition_field && condition_value !== undefined && condition_value !== null && String(condition_value).trim() !== "" ? ` | ${condition_field} = ${written_value(condition_value)}` : "";
  if (!inside && !where) return `{{${formula}}}`;
  return `{{${formula}(${inside}${where})}}`;
}

/** The formula of one token, or "" when it is not a variable. */
export const token_formula = (token) => {
  const match = new RegExp(VARIABLE_PATTERN.source).exec(String(token || ""));
  return match ? match[1] : "";
};

/** One computed figure as the text shows it. */
export function format_variable(formula, value) {
  if (value === undefined) return "...";
  if (value === null) return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  const shown = (Math.round(number * 100) / 100).toLocaleString("en-US");
  return formula === "share" ? `${shown}%` : shown;
}

/** The body with every token replaced by its figure (values null: still loading, every token reads "..."). */
export function substitute_variables(body, values) {
  return String(body || "").replace(new RegExp(VARIABLE_PATTERN.source, "g"), (token, formula) => format_variable(formula, values ? values[token] : undefined));
}
