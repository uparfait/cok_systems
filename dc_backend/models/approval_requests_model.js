const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");

const COLLECTION_NAME = "dcs_approval_requests";

/** The approver's link token is the only way a batch is ever fetched publicly. */
async function ensure_approval_request_indexes() {
  await get_db().collection(COLLECTION_NAME).createIndex({ "approvers.token": 1 }, { name: "approver_token" });
  await get_db().collection(COLLECTION_NAME).createIndex({ form_group_id: 1, created_at: -1 }, { name: "form_group_created_at" });
}

/** Stores one freshly fired batch approval request. */
async function create_request(request_data) {
  const document = Object.assign({}, request_data, { created_at: new Date() });
  const result = await get_db().collection(COLLECTION_NAME).insertOne(document);
  return Object.assign({ _id: result.insertedId }, document);
}

/** Finds the batch owning an approver link token. */
async function find_by_token(token) {
  if (!token) return null;
  return get_db().collection(COLLECTION_NAME).findOne({ "approvers.token": token });
}

/** One batch by its own id, or null. */
async function find_by_id(request_id) {
  const object_id = to_object_id(request_id.toString());
  if (!object_id) return null;
  return get_db().collection(COLLECTION_NAME).findOne({ _id: object_id });
}

/** Every batch a page of submissions references, fetched in one query. */
async function find_by_ids(request_ids) {
  const object_ids = (request_ids || []).map((id) => to_object_id(id.toString())).filter(Boolean);
  if (object_ids.length === 0) return [];
  return get_db()
    .collection(COLLECTION_NAME)
    .find({ _id: { $in: object_ids } })
    .toArray();
}

/** Persists a batch's whole updated approvers/status after an OTP attempt or a decision. */
async function update_request(request_id, patch) {
  await get_db().collection(COLLECTION_NAME).updateOne({ _id: request_id }, { $set: patch });
}

/** True while any batch of this form is still waiting on approvers - a recurring trigger holds off until it's decided. */
async function has_pending_request(form_group_id) {
  const pending = await get_db().collection(COLLECTION_NAME).findOne({ form_group_id, status: "pending" }, { projection: { _id: 1 } });
  return !!pending;
}

/** Every still-pending batch routed to one approver email, newest first - the approver page's form switcher. */
async function list_pending_by_approver_email(email) {
  if (!email) return [];
  return get_db()
    .collection(COLLECTION_NAME)
    .find({ status: "pending", "approvers.email": email.toString().trim().toLowerCase() })
    .sort({ created_at: -1 })
    .limit(20)
    .toArray();
}

/** Recent batches fired for one form, newest first - the scheduling dialog's history. */
async function list_by_form_group(form_group_id, limit) {
  return get_db()
    .collection(COLLECTION_NAME)
    .find({ form_group_id })
    .sort({ created_at: -1 })
    .limit(limit || 10)
    .toArray();
}

module.exports = {
  ensure_approval_request_indexes,
  create_request,
  find_by_token,
  find_by_id,
  find_by_ids,
  update_request,
  has_pending_request,
  list_pending_by_approver_email,
  list_by_form_group,
};
