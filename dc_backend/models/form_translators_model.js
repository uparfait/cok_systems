const { get_db } = require("../db_connection/db.js");

const COLLECTION_NAME = "dcs_form_translators";

/**
 * Who works through a translation link: one document per (link, email).
 * The public page asks the translator for name, email and phone; a known
 * email fetches their own saved texts and the page they stopped on, an
 * unknown one is created here on the spot. Nothing about a translator is
 * an authorization - the link token is - this only attributes the work.
 */

const ensure_indexes_once = (() => {
  let done = false;
  return async () => {
    if (done) return;
    done = true;
    try {
      await get_db().collection(COLLECTION_NAME).createIndex({ link_id: 1, email: 1 }, { unique: true });
    } catch (error) {
      // Indexes are a speed-up, never a requirement.
    }
  };
})();

async function get_by_email(link_id, email) {
  return get_db().collection(COLLECTION_NAME).findOne({ link_id, email });
}

/**
 * Creates the translator for this link or refreshes their name, phone and
 * (when given) the page they are on. Returns the stored document.
 */
async function upsert(link_id, form_group_id, translator, last_page) {
  await ensure_indexes_once();
  const now = new Date();
  const set = { name: translator.name, phone: translator.phone, last_seen_at: now, updated_at: now };
  const on_insert = { link_id, form_group_id, email: translator.email, created_at: now };
  // A path may live in $set or $setOnInsert, never both.
  if (Number.isInteger(last_page) && last_page >= 0) set.last_page = last_page;
  else on_insert.last_page = 0;
  await get_db()
    .collection(COLLECTION_NAME)
    .updateOne({ link_id, email: translator.email }, { $set: set, $setOnInsert: on_insert }, { upsert: true });
  return get_by_email(link_id, translator.email);
}

async function list_by_link(link_id) {
  return get_db().collection(COLLECTION_NAME).find({ link_id }).sort({ created_at: 1 }).toArray();
}

async function delete_by_link(link_id) {
  const result = await get_db().collection(COLLECTION_NAME).deleteMany({ link_id });
  return result.deletedCount;
}

module.exports = { get_by_email, upsert, list_by_link, delete_by_link };
