const { get_db } = require("../db_connection/db.js");
const { base_stages, filter_stages, numeric_expr } = require("./match_stage.js");
const { is_multi_value } = require("./field_catalog.js");
const { CHART_KINDS } = require("./constants.js");

const SUBMISSIONS_COLLECTION = "dcs_submissions";

/**
 * LIVE FIGURES inside a text block.
 *
 * A note on a report says "Fire incidents (5 deaths) pose the highest
 * fatality risk". Typed in, that 5 is stale the day after. Written as
 * {{sum(number_ca002e | single_select_7c5216 = fire)}} it is computed
 * whenever the block is read - under the widget's own filters, the
 * board's filters and the period, exactly like every other widget.
 *
 * The grammar is deliberately small:
 *   {{count}}                        records in scope
 *   {{count(field)}}                 records that answered the field
 *   {{count(field = value)}}         records holding that value
 *   {{sum(field)}} {{avg(field)}} {{min(field)}} {{max(field)}}
 *   {{count_distinct(field)}}        how many different answers
 *   {{share(field = value)}}         percent of the records in scope
 *   ... | other_field = value        narrows any of them to a condition
 * A value may be quoted ('fire' or "fire"); quotes are stripped.
 */
const TEXT_FORMULAS = ["count", "count_distinct", "sum", "avg", "min", "max", "share"];
const NUMERIC = ["sum", "avg", "min", "max"];
const MAX_TEXT_VARIABLES = 20;
const VARIABLE_PATTERN = /\{\{\s*([a-z_]+)\s*(?:\(([^{}()]*)\))?\s*\}\}/g;

const strip_quotes = (text) => {
  const value = String(text || "").trim();
  return /^(['"]).*\1$/.test(value) && value.length >= 2 ? value.slice(1, -1) : value;
};

/** "field" or "field = value" -> { field_id, value } (value undefined when absent), null when malformed. */
function parse_part(text) {
  const part = String(text || "").trim();
  if (!part) return null;
  const at = part.indexOf("=");
  if (at < 0) return /^[A-Za-z0-9_.-]+$/.test(part) ? { field_id: part, value: undefined } : null;
  const field_id = part.slice(0, at).trim();
  const value = strip_quotes(part.slice(at + 1));
  if (!/^[A-Za-z0-9_.-]+$/.test(field_id) || value === "") return null;
  return { field_id, value };
}

/**
 * Every variable a body carries: { variables: [{ token, formula, target,
 * condition }], problems: [text] }. Tokens are deduplicated - the same
 * figure written twice is computed once.
 */
function parse_text_variables(body) {
  const variables = [];
  const problems = [];
  const seen = new Set();
  const text = String(body || "");
  let match;
  VARIABLE_PATTERN.lastIndex = 0;
  while ((match = VARIABLE_PATTERN.exec(text)) !== null) {
    const token = match[0];
    if (seen.has(token)) continue;
    seen.add(token);
    const formula = match[1];
    if (!TEXT_FORMULAS.includes(formula)) {
      problems.push(`${token}: unknown formula "${formula}" (one of ${TEXT_FORMULAS.join(", ")})`);
      continue;
    }
    const inside = match[2] === undefined ? "" : match[2];
    const pieces = inside.split("|");
    if (pieces.length > 2) {
      problems.push(`${token}: only one condition may follow the |`);
      continue;
    }
    const target = pieces[0].trim() ? parse_part(pieces[0]) : null;
    const condition = pieces.length === 2 ? parse_part(pieces[1]) : null;
    if (pieces[0].trim() && !target) {
      problems.push(`${token}: write a field, or a field = value`);
      continue;
    }
    if (pieces.length === 2 && (!condition || condition.value === undefined)) {
      problems.push(`${token}: the condition after | must be a field = value`);
      continue;
    }
    if (formula !== "count" && !target) {
      problems.push(`${token}: ${formula} needs a field`);
      continue;
    }
    if (formula === "share" && (!target || target.value === undefined)) {
      problems.push(`${token}: share needs a field = value to count the share of`);
      continue;
    }
    if (target && target.value !== undefined && !["count", "share"].includes(formula)) {
      problems.push(`${token}: ${formula} reads a field; put the value after | as a condition`);
      continue;
    }
    variables.push({ token, formula, target, condition });
  }
  if (variables.length > MAX_TEXT_VARIABLES) problems.push(`a text block computes at most ${MAX_TEXT_VARIABLES} figures`);
  return { variables, problems };
}

/** The field ids a parsed variable names. */
const variable_fields = (variable) => [variable.target, variable.condition].filter(Boolean).map((part) => part.field_id);

const eq = (part) => ({ field_id: part.field_id, operator: "eq", value: part.value });
const answered = (field_id) => ({ $match: { [`data.${field_id}`]: { $nin: [null, ""] } } });

/** The $facet sub-pipeline computing one variable over the records in scope. */
function variable_stages(variable, catalog) {
  const stages = [];
  if (variable.condition) stages.push(...filter_stages({ filters: [eq(variable.condition)] }));
  const target = variable.target;
  if (variable.formula === "count" || variable.formula === "share") {
    if (target && target.value !== undefined) stages.push(...filter_stages({ filters: [eq(target)] }));
    else if (target) stages.push(answered(target.field_id));
    stages.push({ $count: "value" });
    return stages;
  }
  stages.push(answered(target.field_id));
  if (variable.formula === "count_distinct") {
    if (is_multi_value(catalog, target.field_id)) stages.push({ $unwind: { path: `$data.${target.field_id}`, preserveNullAndEmptyArrays: false } });
    stages.push({ $group: { _id: null, value: { $addToSet: `$data.${target.field_id}` } } }, { $set: { value: { $size: { $ifNull: ["$value", []] } } } });
    return stages;
  }
  const operator = { sum: "$sum", avg: "$avg", min: "$min", max: "$max" }[variable.formula];
  stages.push({ $project: { n: numeric_expr(target.field_id) } }, { $match: { n: { $ne: null } } }, { $group: { _id: null, value: { [operator]: "$n" } } });
  return stages;
}

const first_value = (rows) => (Array.isArray(rows) && rows[0] && rows[0].value !== undefined && rows[0].value !== null ? rows[0].value : null);
const round = (value, places) => (value === null ? null : Math.round(Number(value) * Math.pow(10, places)) / Math.pow(10, places));

/**
 * The data of a text block: { kind: "text", values: { "<token>": number } }.
 * A block with no variables costs no query. Every figure is computed in
 * ONE $facet round trip over the records in the widget's scope.
 */
async function text_data(widget, bounds, catalog) {
  const body = widget && widget.text ? widget.text.body : "";
  const { variables } = parse_text_variables(body);
  if (variables.length === 0) return { kind: CHART_KINDS.TEXT, values: {} };
  const facets = {};
  variables.forEach((variable, index) => {
    facets[`v${index}`] = variable_stages(variable, catalog);
  });
  if (variables.some((variable) => variable.formula === "share")) facets.all = [{ $count: "value" }];
  const [facet] = await get_db().collection(SUBMISSIONS_COLLECTION).aggregate([...base_stages(widget, bounds), { $facet: facets }], { allowDiskUse: true }).toArray();
  const all = facet ? first_value(facet.all) || 0 : 0;
  const values = {};
  variables.forEach((variable, index) => {
    const raw = facet ? first_value(facet[`v${index}`]) : null;
    if (variable.formula === "count" || variable.formula === "count_distinct") values[variable.token] = raw || 0;
    else if (variable.formula === "share") values[variable.token] = all > 0 ? round(((raw || 0) / all) * 100, 1) : 0;
    else values[variable.token] = NUMERIC.includes(variable.formula) ? round(raw, 2) : raw;
  });
  return { kind: CHART_KINDS.TEXT, values };
}

module.exports = { text_data, parse_text_variables, variable_fields, TEXT_FORMULAS, MAX_TEXT_VARIABLES, VARIABLE_PATTERN };
