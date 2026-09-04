const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");

const COLLECTION_NAME = "dcs_approval_schedules";

/** Fast lookup of a form's schedule, plus the runner's "what is due now" scan. */
async function ensure_approval_schedule_indexes() {
  await get_db().collection(COLLECTION_NAME).createIndex({ form_group_id: 1, status: 1 }, { name: "form_group_status" });
}

/** The one currently active (still waiting to fire) schedule of a form, or null. */
async function get_active_schedule(form_group_id) {
  return get_db().collection(COLLECTION_NAME).findOne({ form_group_id, status: "scheduled" });
}

/**
 * Creates or replaces a form's active schedule - a form only ever has one
 * schedule waiting to fire, so saving again simply overwrites it.
 */
async function upsert_schedule(form_group_id, schedule_data) {
  const now = new Date();
  const result = await get_db()
    .collection(COLLECTION_NAME)
    .findOneAndUpdate(
      { form_group_id, status: "scheduled" },
      {
        $set: Object.assign({}, schedule_data, { form_group_id, status: "scheduled", updated_at: now }),
        $setOnInsert: { created_at: now },
      },
      { upsert: true, returnDocument: "after" },
    );
  return result && result.value ? result.value : get_active_schedule(form_group_id);
}

/** Cancels a form's active schedule; true when one actually existed. */
async function cancel_schedule(form_group_id) {
  const result = await get_db()
    .collection(COLLECTION_NAME)
    .updateOne({ form_group_id, status: "scheduled" }, { $set: { status: "cancelled", cancelled_at: new Date() } });
  return result.modifiedCount > 0;
}

/**
 * Marks a schedule fired exactly once: the matched-then-modified filter on
 * status means two concurrent trigger checks can never both send.
 */
async function claim_schedule_for_sending(schedule_id) {
  const object_id = to_object_id(schedule_id.toString());
  const result = await get_db()
    .collection(COLLECTION_NAME)
    .updateOne({ _id: object_id, status: "scheduled" }, { $set: { status: "sending" } });
  return result.modifiedCount > 0;
}

/** Records the outcome of a fired one-shot schedule (request_id is null when there was no data to send). */
async function mark_schedule_sent(schedule_id, request_id, sent_count) {
  const object_id = to_object_id(schedule_id.toString());
  await get_db()
    .collection(COLLECTION_NAME)
    .updateOne({ _id: object_id }, { $set: { status: "sent", sent_at: new Date(), request_id: request_id || null, sent_count: sent_count || 0 } });
}

/**
 * Records one firing of a RECURRING schedule ("after N responses") and puts
 * it straight back to waiting, so the next N collected responses fire it
 * again - reschedule-free repetition.
 */
async function record_schedule_fire(schedule_id, request_id, sent_count) {
  const object_id = to_object_id(schedule_id.toString());
  await get_db()
    .collection(COLLECTION_NAME)
    .updateOne(
      { _id: object_id },
      {
        $set: { status: "scheduled", last_sent_at: new Date(), last_request_id: request_id || null, last_sent_count: sent_count || 0 },
        $inc: { times_sent: 1 },
      },
    );
}

/** Returns a claimed-but-failed schedule to the waiting state so it can fire again. */
async function release_schedule(schedule_id) {
  const object_id = to_object_id(schedule_id.toString());
  await get_db().collection(COLLECTION_NAME).updateOne({ _id: object_id, status: "sending" }, { $set: { status: "scheduled" } });
}

/** Every count-triggered schedule of one form still waiting to fire. */
async function find_count_schedules(form_group_id) {
  return get_db()
    .collection(COLLECTION_NAME)
    .find({ form_group_id, status: "scheduled", "trigger.type": "count" })
    .toArray();
}

/** Every datetime-triggered schedule whose moment has arrived, across all forms - the interval runner's scan. */
async function find_due_datetime_schedules(now) {
  return get_db()
    .collection(COLLECTION_NAME)
    .find({ status: "scheduled", "trigger.type": "datetime", "trigger.datetime": { $lte: now } })
    .toArray();
}

/** Recent schedule history of a form (sent/cancelled included), newest first - the dialog's activity list. */
async function list_schedule_history(form_group_id, limit) {
  return get_db()
    .collection(COLLECTION_NAME)
    .find({ form_group_id })
    .sort({ created_at: -1 })
    .limit(limit || 10)
    .toArray();
}

module.exports = {
  ensure_approval_schedule_indexes,
  get_active_schedule,
  upsert_schedule,
  cancel_schedule,
  claim_schedule_for_sending,
  mark_schedule_sent,
  record_schedule_fire,
  release_schedule,
  find_count_schedules,
  find_due_datetime_schedules,
  list_schedule_history,
};
