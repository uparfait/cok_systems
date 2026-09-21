const tokens_model = require("../../models/data_feed_tokens_model.js");
const submissions_model = require("../../models/submissions_model.js");
const forms_model = require("../../models/forms_model.js");
const { resolve_client_origin } = require("../../utilities/approval_email.js");
const { format_respondent } = require("../../utilities/respondent.js");
const { build_diffed_columns, format_cell } = require("../../utilities/export_columns.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");
const { translate } = require("../../i18n/index.js");

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;
const BATCH_SIZE = 1000;

/**
 * The public data feed an external tool reads a form's responses from,
 * authorized by a data-feed token (in the path, ?token= or a Bearer
 * header). JSON pages { count, next, previous, results } or one CSV stream,
 * flat rows keyed by field label (or id with ?keys=id), plus a schema
 * endpoint describing the columns. Query filters - from, to, since,
 * version - always stay inside the token's own scope.
 */
function token_from(req) {
  if (req.params && req.params.token) return req.params.token;
  if (req.query && typeof req.query.token === "string") return req.query.token;
  const header = req.get && req.get("authorization");
  if (header && /^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, "").trim();
  return "";
}

async function resolve_token(req, res) {
  const token = await tokens_model.get_by_token(token_from(req));
  if (!token || token.revoked_at) {
    res.status(401).json(warning_response(req, "DATA_TOKEN_INVALID"));
    return null;
  }
  if (token.expires_at && new Date(token.expires_at).getTime() < Date.now()) {
    res.status(410).json(warning_response(req, "DATA_TOKEN_EXPIRED"));
    return null;
  }
  const versions = await forms_model.get_versions_by_group(token.form_group_id);
  if (!versions || versions.length === 0) {
    res.status(404).json(warning_response(req, "FORM_NOT_FOUND"));
    return null;
  }
  return { token, versions };
}

const date_of = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** The query's window narrowed to the token's scope: a reader never widens what the token allows. */
function feed_filter(token, query) {
  const scope = token.scope || {};
  const asked_from = date_of(query.from);
  const asked_to = date_of(query.to);
  const since = date_of(query.since);
  let start = scope.from ? new Date(scope.from) : null;
  let end = scope.to ? new Date(scope.to) : null;
  if (asked_from && (!start || asked_from > start)) start = asked_from;
  if (since && (!start || since > start)) start = since;
  if (asked_to && (!end || asked_to < end)) end = asked_to;
  const asked_version = query.version === undefined || query.version === "" ? null : Number(query.version);
  const version = scope.version !== null && scope.version !== undefined ? scope.version : Number.isFinite(asked_version) ? asked_version : null;
  return { start, end, version };
}

/** Column keys the rows use: labels made unique, or field ids. */
function column_keys(columns, mode) {
  const seen = new Map();
  return columns.map((column) => {
    if (mode === "id") return column.key;
    const base = String(column.label || column.key).trim() || column.key;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function row_values(submission, columns, field_type_by_id, origin) {
  const data = submission.data || {};
  return columns.map((column) => {
    if (column.key === "version") return submission.version || "";
    if (column.key === "submitted_by") return format_respondent(submission.respondent);
    if (column.key === "submitted_at") return submission.submitted_at ? new Date(submission.submitted_at).toISOString() : "";
    const raw = data[column.key];
    // Numbers and booleans stay typed so a BI tool sums and filters them as such.
    if (typeof raw === "number" || typeof raw === "boolean") return raw;
    return format_cell(raw, field_type_by_id.get(column.key), origin);
  });
}

function csv_escape(value) {
  const text = String(value === null || value === undefined ? "" : value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function prepare(context, req) {
  const lang = (req.query && req.query.language) || req.language || "en";
  const { columns, field_type_by_id } = build_diffed_columns(context.versions, lang, translate);
  const all_columns = [{ key: "_id", label: "id", type: "id" }].concat(columns);
  const keys = column_keys(all_columns, req.query && req.query.keys === "id" ? "id" : "label");
  return { columns: all_columns, keys, field_type_by_id, origin: resolve_client_origin(req), filter: feed_filter(context.token, req.query || {}) };
}

async function get_data_feed(req, res) {
  try {
    const context = await resolve_token(req, res);
    if (!context) return undefined;
    tokens_model.count_use(context.token._id);
    const { columns, keys, field_type_by_id, origin, filter } = prepare(context, req);
    const form_group_id = context.token.form_group_id;
    const format = String((req.query && req.query.format) || "json").toLowerCase();

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${form_group_id}.csv"`);
      // A byte-order mark up front so Excel opens the CSV as UTF-8.
      res.write(String.fromCharCode(65279) + keys.map(csv_escape).join(",") + "\r\n");
      const cursor = submissions_model.stream_feed(form_group_id, filter, 0, 0, BATCH_SIZE);
      let written = 0;
      for await (const submission of cursor) {
        const values = row_values(submission, columns.slice(1), field_type_by_id, origin);
        const line = [submission._id.toString()].concat(values).map(csv_escape).join(",") + "\r\n";
        if (!res.write(line)) await new Promise((resolve) => res.once("drain", resolve));
        written += 1;
        if (written % 500 === 0) await new Promise((resolve) => setImmediate(resolve));
      }
      res.end();
      return undefined;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
    const [count, items] = await Promise.all([
      submissions_model.count_feed(form_group_id, filter),
      submissions_model.stream_feed(form_group_id, filter, (page - 1) * limit, limit, BATCH_SIZE).toArray(),
    ]);
    const results = items.map((submission) => {
      const values = [submission._id.toString()].concat(row_values(submission, columns.slice(1), field_type_by_id, origin));
      const row = {};
      keys.forEach((key, index) => {
        row[key] = values[index];
      });
      return row;
    });
    const page_url = (target) => {
      const params = new URLSearchParams(req.query);
      params.set("page", String(target));
      return `${req.baseUrl}${req.path}?${params.toString()}`;
    };
    return res.status(200).json({
      count,
      page,
      limit,
      next: page * limit < count ? page_url(page + 1) : null,
      previous: page > 1 ? page_url(page - 1) : null,
      results,
    });
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

/** The columns a reader will get, with the field each comes from. */
async function get_data_feed_schema(req, res) {
  try {
    const context = await resolve_token(req, res);
    if (!context) return undefined;
    const { columns, keys, field_type_by_id, filter } = prepare(context, req);
    const schema = columns.map((column, index) => ({ key: keys[index], label: column.label, field_id: column.key, type: column.type || field_type_by_id.get(column.key) || "text" }));
    return res.status(200).json(
      success_response(req, "DATA_FEED_FETCHED", {
        form_group_id: context.token.form_group_id,
        form_name: (context.versions.find((entry) => entry.is_active) || context.versions[0]).form_name,
        token_name: context.token.name,
        scope: { version: filter.version, from: filter.start, to: filter.end },
        columns: schema,
      }),
    );
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = { get_data_feed, get_data_feed_schema };
