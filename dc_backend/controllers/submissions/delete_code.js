const crypto = require("crypto");
const deletion_requests_model = require("../../models/deletion_requests_model.js");
const submissions_model = require("../../models/submissions_model.js");
const { resolve_deletable_submissions } = require("./deletable_submissions.js");
const { send_deletion_code_email, resolve_client_origin } = require("../../utilities/approval_email.js");
const { mask_email } = require("../../utilities/batch_session.js");
const { remove_record_files } = require("../../utilities/media_files.js");
const { success_response, warning_response, error_response } = require("../../utilities/response.js");

const { EXPIRES_MINUTES, MAX_ATTEMPTS, RESEND_WAIT_SECONDS } = deletion_requests_model;

const is_production = () => process.env.NODE_ENV === "production";

/**
 * Deleting records from the data table takes two steps: the ticked ids are
 * permission-checked and stored with a 6-digit code mailed to the signed-in
 * user, then the code confirms exactly those ids. Nothing is removed before
 * the right code comes back.
 */

/** What the browser learns about a request. The code itself leaves the server only by mail in production. */
function sent_payload(request, email_sent) {
  const payload = {
    request_id: request._id.toString(),
    email_masked: mask_email(request.email),
    expires_at: request.expires_at,
    count: request.submission_ids.length,
    email_sent,
  };
  if (!is_production()) payload.code = request.code;
  return payload;
}

async function mail_code(req, request) {
  const result = await send_deletion_code_email({
    to: request.email,
    full_name: req.user.full_name,
    code: request.code,
    count: request.submission_ids.length,
    expires_minutes: EXPIRES_MINUTES,
    language: req.language,
    origin: resolve_client_origin(req),
  });
  if (!is_production()) {
    console.log(`[DELETE CODE] ${request.email}: ${request.code} (${result.success ? "sent" : `FAILED - ${result.error || "unknown error"}`})`);
  }
  return result;
}

/** Finds the signed-in user's own request; answers { status, key } when it cannot be acted on, else { request }. */
async function load_own_request(req) {
  const { request_id } = req.body || {};
  const request = await deletion_requests_model.find_request(request_id);
  if (!request) return { status: 404, key: "NOT_FOUND" };
  if (request.user_id !== String(req.user.user_id)) return { status: 403, key: "ACCESS_DENIED" };
  if (request.used_at || new Date(request.expires_at).getTime() <= Date.now()) return { status: 410, key: "DELETE_CODE_EXPIRED" };
  if (request.attempts >= MAX_ATTEMPTS) return { status: 429, key: "DELETE_CODE_TOO_MANY" };
  return { request };
}

function code_matches(expected, given) {
  const a = Buffer.from(String(expected || ""));
  const b = Buffer.from(String(given || "").trim());
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function request_delete_code(req, res) {
  try {
    if (!req.user.email) return res.status(400).json(warning_response(req, "VALIDATION_FAILED"));
    // The same refusal the deletion itself would give, before any mail goes out.
    const resolved = await resolve_deletable_submissions(req.user, (req.body || {}).submission_ids);
    if (resolved.status) return res.status(resolved.status).json(warning_response(req, resolved.key));

    const request = await deletion_requests_model.create_request({
      user_id: req.user.user_id,
      email: req.user.email,
      submission_ids: resolved.submissions.map((submission) => submission._id),
    });
    const mail = await mail_code(req, request);
    if (!mail.success && is_production()) return res.status(502).json(warning_response(req, "DELETE_CODE_MAIL_FAILED"));
    return res
      .status(200)
      .json(success_response(req, "DELETE_CODE_SENT", sent_payload(request, mail.success), { email: mask_email(request.email) }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function confirm_delete_code(req, res) {
  try {
    const loaded = await load_own_request(req);
    if (loaded.status) return res.status(loaded.status).json(warning_response(req, loaded.key));
    const { request } = loaded;

    if (!code_matches(request.code, (req.body || {}).code)) {
      const attempts = await deletion_requests_model.bump_attempts(request._id);
      if (attempts >= MAX_ATTEMPTS) return res.status(429).json(warning_response(req, "DELETE_CODE_TOO_MANY"));
      return res.status(401).json(warning_response(req, "DELETE_CODE_WRONG", null, { attempts_left: MAX_ATTEMPTS - attempts }));
    }

    // The right code: the same permission answer as at request time, on
    // exactly the rows the request named and nothing else.
    const resolved = await resolve_deletable_submissions(req.user, request.submission_ids);
    if (resolved.status === 404) {
      // Every row went away in the meantime; the request is spent all the same.
      await deletion_requests_model.mark_used(request._id);
      return res.status(200).json(success_response(req, "SUBMISSIONS_DELETED", { deleted: 0 }, { count: 0 }));
    }
    if (resolved.status) return res.status(resolved.status).json(warning_response(req, resolved.key));

    // The records' uploaded files go with them - the only moment a file
    // ever leaves the disk (see utilities/media_files.js): read before the
    // delete, removed after it, in one pass, never fatal.
    const ids = resolved.submissions.map((submission) => submission._id);
    const media_bearing = await submissions_model.find_media_bearing_by_ids(ids);
    const deleted = await submissions_model.delete_submissions_by_ids(ids);
    const files_removed = deleted > 0 ? await remove_record_files(media_bearing) : 0;
    await deletion_requests_model.mark_used(request._id);
    return res.status(200).json(success_response(req, "SUBMISSIONS_DELETED", { deleted, files_removed }, { count: deleted }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

async function resend_delete_code(req, res) {
  try {
    const loaded = await load_own_request(req);
    if (loaded.status) return res.status(loaded.status).json(warning_response(req, loaded.key));
    const { request } = loaded;

    const since_ms = Date.now() - new Date(request.sent_at || request.created_at).getTime();
    if (since_ms < RESEND_WAIT_SECONDS * 1000) {
      const seconds = Math.ceil((RESEND_WAIT_SECONDS * 1000 - since_ms) / 1000);
      return res.status(429).json(warning_response(req, "DELETE_CODE_RESEND_WAIT", { seconds }, { retry_in: seconds }));
    }

    // Counted before the mail goes out: the wait limits the mail server's load, sent or not.
    await deletion_requests_model.mark_sent(request._id);
    const mail = await mail_code(req, request);
    if (!mail.success && is_production()) return res.status(502).json(warning_response(req, "DELETE_CODE_MAIL_FAILED"));
    return res
      .status(200)
      .json(success_response(req, "DELETE_CODE_SENT", sent_payload(request, mail.success), { email: mask_email(request.email) }));
  } catch (error) {
    return res.status(500).json(error_response(req, "SERVER_ERROR", null, error.message));
  }
}

module.exports = { request_delete_code, confirm_delete_code, resend_delete_code };
