const crypto = require("crypto");
const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");

const COLLECTION_NAME = "dcs_deletion_requests";
const EXPIRES_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const RESEND_WAIT_SECONDS = 30;
// An expired row keeps answering "expired" for a day before Mongo drops it.
const KEEP_EXPIRED_SECONDS = 24 * 60 * 60;

/**
 * One row per "Delete selected" that is waiting for the code mailed to the
 * user who asked: which records, the code, how many wrong tries, when it
 * stops being valid and when it was spent. The deletion itself only ever
 * runs through the confirm step, against exactly the ids stored here.
 */

const ensure_indexes_once = (() => {
  let done = false;
  return async () => {
    if (done) return;
    done = true;
    try {
      await get_db().collection(COLLECTION_NAME).createIndex({ expires_at: 1 }, { expireAfterSeconds: KEEP_EXPIRED_SECONDS });
      await get_db().collection(COLLECTION_NAME).createIndex({ user_id: 1, created_at: -1 });
    } catch (error) {
      // Indexes are a speed-up, never a requirement.
    }
  };
})();

/** A 6-digit code, zero-padded, from the crypto random source. */
function generate_code() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

async function create_request({ user_id, email, submission_ids }) {
  await ensure_indexes_once();
  const now = new Date();
  const document = {
    user_id: String(user_id),
    email: String(email || "").trim(),
    submission_ids: (submission_ids || []).map((id) => to_object_id(id)).filter(Boolean),
    code: generate_code(),
    attempts: 0,
    expires_at: new Date(now.getTime() + EXPIRES_MINUTES * 60 * 1000),
    used_at: null,
    sent_at: now,
    created_at: now,
  };
  const result = await get_db().collection(COLLECTION_NAME).insertOne(document);
  return Object.assign({ _id: result.insertedId }, document);
}

async function find_request(request_id) {
  const object_id = to_object_id(request_id);
  if (!object_id) return null;
  return get_db().collection(COLLECTION_NAME).findOne({ _id: object_id });
}

/** Counts one more wrong code; answers the new total. */
async function bump_attempts(request_id) {
  const object_id = to_object_id(request_id);
  if (!object_id) return 0;
  const updated = await get_db()
    .collection(COLLECTION_NAME)
    .findOneAndUpdate({ _id: object_id }, { $inc: { attempts: 1 } }, { returnDocument: "after" });
  const document = updated && updated.value !== undefined ? updated.value : updated;
  return document ? document.attempts : 0;
}

async function mark_used(request_id) {
  const object_id = to_object_id(request_id);
  if (!object_id) return;
  await get_db().collection(COLLECTION_NAME).updateOne({ _id: object_id }, { $set: { used_at: new Date() } });
}

/** The moment the code last went out, which the resend wait is counted from. */
async function mark_sent(request_id) {
  const object_id = to_object_id(request_id);
  if (!object_id) return;
  await get_db().collection(COLLECTION_NAME).updateOne({ _id: object_id }, { $set: { sent_at: new Date() } });
}

module.exports = {
  create_request,
  find_request,
  bump_attempts,
  mark_used,
  mark_sent,
  EXPIRES_MINUTES,
  MAX_ATTEMPTS,
  RESEND_WAIT_SECONDS,
};
