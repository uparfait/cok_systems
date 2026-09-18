const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");

const COLLECTION_NAME = "dcs_form_translation_proposals";

/**
 * What a translator saves through a translation link. Nothing is written
 * into the form here: each document is one PROPOSED text - a field, the
 * path of the text on it, a language, the proposed value and the value the
 * form held when it was proposed. The form's editor reviews them and
 * applies the ones they choose; an applied proposal keeps the text it
 * replaced so it can be restored later. Statuses: pending, applied,
 * restored.
 */

const ensure_indexes_once = (() => {
  let done = false;
  return async () => {
    if (done) return;
    done = true;
    try {
      await get_db().collection(COLLECTION_NAME).createIndex({ link_id: 1, field_id: 1, path_key: 1, language: 1, status: 1 });
      await get_db().collection(COLLECTION_NAME).createIndex({ form_group_id: 1, status: 1 });
    } catch (error) {
      // Indexes are a speed-up, never a requirement.
    }
  };
})();

/**
 * Saves one proposal: a pending proposal for the same text of the same link
 * is replaced (a translator correcting themself), anything already applied
 * or restored stays as history and a new pending one is written.
 */
async function upsert_pending(proposal) {
  await ensure_indexes_once();
  const now = new Date();
  const filter = { link_id: proposal.link_id, field_id: proposal.field_id, path_key: proposal.path_key, language: proposal.language, status: "pending" };
  const document = Object.assign({}, proposal, { status: "pending", proposed_at: now, updated_at: now });
  await get_db().collection(COLLECTION_NAME).updateOne(filter, { $set: document }, { upsert: true });
}

async function list_by_link(link_id) {
  return get_db().collection(COLLECTION_NAME).find({ link_id }).sort({ proposed_at: 1 }).toArray();
}

async function list_by_form(form_group_id) {
  return get_db().collection(COLLECTION_NAME).find({ form_group_id }).sort({ proposed_at: 1 }).toArray();
}

/** { link_id: { pending, applied } } for every link of a form. */
async function count_by_link(form_group_id) {
  const rows = await get_db()
    .collection(COLLECTION_NAME)
    .aggregate([{ $match: { form_group_id } }, { $group: { _id: { link_id: "$link_id", status: "$status" }, count: { $sum: 1 } } }])
    .toArray();
  const out = {};
  rows.forEach((row) => {
    const link_id = row._id.link_id;
    if (!out[link_id]) out[link_id] = { pending: 0, applied: 0, restored: 0 };
    out[link_id][row._id.status] = row.count;
  });
  return out;
}

async function get_by_ids(ids) {
  const object_ids = (ids || []).map((id) => to_object_id(id)).filter(Boolean);
  if (object_ids.length === 0) return [];
  return get_db().collection(COLLECTION_NAME).find({ _id: { $in: object_ids } }).toArray();
}

/** Marks proposals applied, each remembering the text it replaced. */
async function mark_applied(entries, applied_by) {
  const now = new Date();
  await Promise.all(
    entries.map((entry) =>
      get_db()
        .collection(COLLECTION_NAME)
        .updateOne({ _id: entry._id }, { $set: { status: "applied", previous_value: entry.previous_value, applied_at: now, applied_by, updated_at: now } }),
    ),
  );
}

async function mark_restored(ids, restored_by) {
  const now = new Date();
  await get_db()
    .collection(COLLECTION_NAME)
    .updateMany({ _id: { $in: ids } }, { $set: { status: "restored", restored_at: now, restored_by, updated_at: now } });
}

async function delete_many(ids) {
  const result = await get_db().collection(COLLECTION_NAME).deleteMany({ _id: { $in: ids } });
  return result.deletedCount;
}

async function delete_by_link(link_id) {
  const result = await get_db().collection(COLLECTION_NAME).deleteMany({ link_id });
  return result.deletedCount;
}

module.exports = {
  upsert_pending,
  list_by_link,
  list_by_form,
  count_by_link,
  get_by_ids,
  mark_applied,
  mark_restored,
  delete_many,
  delete_by_link,
};
