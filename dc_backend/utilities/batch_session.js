const crypto = require("crypto");

/**
 * A batch approver proves who they are once, with the one-time code from
 * their email. That exchange issues a short-lived session signature which
 * every later request carries in the x-approval-signature header, so the
 * code itself is never replayed and never has to be kept by the browser.
 */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_HEADER = "x-approval-signature";
const IDEMPOTENCY_HEADER = "x-idempotency-key";

/** Mints a fresh signature on the approver step, replacing any earlier one. */
function issue_session(approver) {
  const signature = crypto.randomBytes(32).toString("hex");
  approver.session_signature = crypto.createHash("sha256").update(signature).digest("hex");
  approver.session_expires_at = new Date(Date.now() + SESSION_TTL_MS);
  return { signature, expires_at: approver.session_expires_at };
}

/** True only for the exact signature this approver was issued, before it expires. */
function is_session_valid(approver, signature) {
  if (!approver || !approver.session_signature || !signature) return false;
  if (!approver.session_expires_at || new Date(approver.session_expires_at).getTime() < Date.now()) return false;
  const hashed = crypto.createHash("sha256").update(String(signature)).digest("hex");
  const expected = Buffer.from(approver.session_signature);
  const given = Buffer.from(hashed);
  if (expected.length !== given.length) return false;
  return crypto.timingSafeEqual(expected, given);
}

function read_session_signature(req) {
  return (req.headers[SESSION_HEADER] || "").toString().trim();
}

function read_idempotency_key(req) {
  const header = (req.headers[IDEMPOTENCY_HEADER] || "").toString().trim();
  if (header) return header.slice(0, 100);
  const body_key = req.body && req.body.idempotency_key;
  return body_key ? body_key.toString().trim().slice(0, 100) : "";
}


/**
 * An address safe to show on a public page: enough to recognise your own
 * inbox, not enough to harvest. Masking belongs here, not in the browser.
 */
function mask_email(email) {
  const value = (email || "").toString().trim();
  const at = value.indexOf("@");
  if (at < 1) return value ? "*****" : "";
  const name = value.slice(0, at);
  const domain = value.slice(at);
  if (name.length <= 2) return name.charAt(0) + "*****" + domain;
  return name.charAt(0) + "*****" + name.charAt(name.length - 1) + domain;
}

module.exports = {
  SESSION_TTL_MS,
  SESSION_HEADER,
  IDEMPOTENCY_HEADER,
  issue_session,
  is_session_valid,
  read_session_signature,
  read_idempotency_key,
  mask_email,
};
