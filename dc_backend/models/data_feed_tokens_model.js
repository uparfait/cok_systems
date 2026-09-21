const crypto = require("crypto");
const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");

const COLLECTION_NAME = "dcs_data_feed_tokens";

/**
 * Access tokens that let an external tool (Power BI, Excel, a script) read
 * a form's collected responses without signing in: a token in the URL is
 * the whole authorization. Each token belongs to one form, may expire on a
 * date or never, may be scoped to one version and a date window, counts
 * its uses and can be rotated (new secret, same settings) or revoked.
 */

const ensure_indexes_once = (() => {
  let done = false;
  return async () => {
    if (done) return;
    done = true;
    try {
      await get_db().collection(COLLECTION_NAME).createIndex({ token: 1 }, { unique: true });
      await get_db().collection(COLLECTION_NAME).createIndex({ form_group_id: 1, created_at: -1 });
    } catch (error) {
      // Indexes are a speed-up, never a requirement.
    }
  };
})();

const new_secret = () => crypto.randomBytes(24).toString("hex");

async function create_token(fields) {
  await ensure_indexes_once();
  const now = new Date();
  const document = Object.assign({}, fields, { token: new_secret(), uses: 0, last_used_at: null, revoked_at: null, created_at: now, updated_at: now });
  const result = await get_db().collection(COLLECTION_NAME).insertOne(document);
  return Object.assign({ _id: result.insertedId }, document);
}

async function list_by_form(form_group_id) {
  return get_db().collection(COLLECTION_NAME).find({ form_group_id: form_group_id.toString() }).sort({ created_at: -1 }).toArray();
}

async function get_by_id(token_id) {
  const object_id = to_object_id(token_id);
  if (!object_id) return null;
  return get_db().collection(COLLECTION_NAME).findOne({ _id: object_id });
}

async function get_by_token(token) {
  if (typeof token !== "string" || token.length < 16) return null;
  return get_db().collection(COLLECTION_NAME).findOne({ token });
}

/** A fresh secret for the same settings; every URL built on the old one stops working. */
async function rotate(token_id) {
  const object_id = to_object_id(token_id);
  if (!object_id) return null;
  await get_db().collection(COLLECTION_NAME).updateOne({ _id: object_id }, { $set: { token: new_secret(), updated_at: new Date() } });
  return get_by_id(token_id);
}

async function delete_token(token_id) {
  const object_id = to_object_id(token_id);
  if (!object_id) return 0;
  const result = await get_db().collection(COLLECTION_NAME).deleteOne({ _id: object_id });
  return result.deletedCount;
}

/** Fire-and-forget usage bookkeeping on every read through the token. */
function count_use(token_id) {
  get_db()
    .collection(COLLECTION_NAME)
    .updateOne({ _id: token_id }, { $inc: { uses: 1 }, $set: { last_used_at: new Date() } })
    .catch(() => {});
}

module.exports = { create_token, list_by_form, get_by_id, get_by_token, rotate, delete_token, count_use };
