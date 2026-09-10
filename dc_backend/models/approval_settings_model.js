const { get_db } = require("../db_connection/db.js");

const COLLECTION_NAME = "dcs_approval_settings";

/**
 * How long an already decided record keeps showing on the approver
 * dashboard. A form that was never configured predates this setting and
 * falls back to the shortest window, so old approved data stops piling up
 * on approvers who already dealt with it.
 */
const RETENTION_WINDOWS = ["week", "month", "year"];
const DEFAULT_RETENTION = "month";
const LEGACY_RETENTION = "week";

const WINDOW_DAYS = { week: 7, month: 30, year: 365 };

async function ensure_approval_settings_indexes() {
  await get_db().collection(COLLECTION_NAME).createIndex({ form_group_id: 1 }, { name: "form_group", unique: true });
}

function is_valid_retention(value) {
  return RETENTION_WINDOWS.includes(String(value || ""));
}

/** The stored settings of one form, or null when it was never configured. */
async function get_settings(form_group_id) {
  return get_db().collection(COLLECTION_NAME).findOne({ form_group_id });
}

/** The retention actually applied to a form right now. */
async function get_approved_retention(form_group_id) {
  const settings = await get_settings(form_group_id);
  const stored = settings && settings.approved_retention;
  return is_valid_retention(stored) ? stored : LEGACY_RETENTION;
}

/** The moment before which decided records stop being shown. */
function retention_cutoff(retention, now) {
  const days = WINDOW_DAYS[retention] || WINDOW_DAYS[LEGACY_RETENTION];
  const reference = now ? new Date(now) : new Date();
  return new Date(reference.getTime() - days * 24 * 60 * 60 * 1000);
}

async function save_approved_retention(form_group_id, retention, email) {
  const value = is_valid_retention(retention) ? retention : DEFAULT_RETENTION;
  const now = new Date();
  await get_db()
    .collection(COLLECTION_NAME)
    .updateOne(
      { form_group_id },
      { $set: { form_group_id, approved_retention: value, updated_at: now, updated_by: email || null }, $setOnInsert: { created_at: now } },
      { upsert: true },
    );
  return value;
}

module.exports = {
  RETENTION_WINDOWS,
  DEFAULT_RETENTION,
  LEGACY_RETENTION,
  ensure_approval_settings_indexes,
  is_valid_retention,
  get_settings,
  get_approved_retention,
  retention_cutoff,
  save_approved_retention,
};
