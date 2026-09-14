const { get_cok_db } = require("../db_connection/db.js");

/**
 * Response audit for the Data Collection System: every response whose
 * status is not a plain success (200/201) is stored as one row in the main
 * system's shared "audits" collection (the same collection the main
 * backend's response audit writes to, same fields), tagged source "dcs".
 * Mounted once before the routes, so the 404 and error handlers are
 * covered too. CORS preflights and 304 revalidations are skipped.
 */

const SKIPPED_STATUSES = new Set([200, 201, 304]);
const AUDITS_COLLECTION = "audits";

function client_ip(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.ip || (req.socket && req.socket.remoteAddress) || null;
}

function as_text(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function parse_body(res) {
  const body = res.locals.audit_body;
  if (body === undefined) return null;
  if (typeof body === "string") {
    const type = String(res.getHeader("content-type") || "");
    if (!type.includes("json")) return null;
    try {
      return JSON.parse(body);
    } catch (error) {
      return null;
    }
  }
  return typeof body === "object" ? body : null;
}

function build_row(req, res) {
  const body = parse_body(res) || {};
  const user = req.user || {};
  const endpoint = req.originalUrl || req.url || "";
  return {
    time: new Date(),
    status: res.statusCode,
    method: req.method,
    user_id: user.user_id ? String(user.user_id) : null,
    user_email: user.email || null,
    user_name: user.full_name || null,
    description: req.audit_description || `${req.method} ${endpoint} answered ${res.statusCode}`,
    message: as_text(body.message),
    error: as_text(body.error) || as_text(body.errors) || as_text(body.field_errors) || null,
    endpoint,
    ip_address: client_ip(req),
    source: "dcs",
  };
}

function audit_response(req, res, next) {
  const original_json = res.json.bind(res);
  const original_send = res.send.bind(res);

  res.json = function (data) {
    res.locals.audit_body = data;
    return original_json(data);
  };
  res.send = function (data) {
    if (res.locals.audit_body === undefined) res.locals.audit_body = data;
    return original_send(data);
  };

  res.on("finish", () => {
    if (req.method === "OPTIONS" || SKIPPED_STATUSES.has(res.statusCode)) return;
    try {
      get_cok_db()
        .collection(AUDITS_COLLECTION)
        .insertOne(build_row(req, res))
        .catch((error) => console.error("[AUDIT] failed to store audit row:", error.message));
    } catch (error) {
      console.error("[AUDIT] audit store unavailable:", error.message);
    }
  });

  next();
}

module.exports = audit_response;
