const { v4: uuid_v4 } = require("uuid");
const { get_db } = require("../db_connection/db.js");

const COLLECTION_NAME = "dcs_follow_up_forms";

/**
 * A follow-up form: one per actual form, with versions of its own exactly
 * like dcs_forms (one document per version, append-only, one active
 * version at a time). follow_up_group_id is the stable identifier of the
 * follow-up across its versions - what its public link carries - and
 * source_form_group_id is the actual form whose records respondents find,
 * load, edit and save as NEW follow-up records.
 */

const collection = () => get_db().collection(COLLECTION_NAME);

/** The fields every version write carries, taken from the caller's data. */
function version_fields(form_data) {
  return {
    project_id: form_data.project_id,
    form_name: form_data.form_name,
    form_name_normalized: form_data.form_name_normalized,
    schema: form_data.schema,
    ask_respondent: form_data.ask_respondent !== false,
  };
}

/**
 * Version 1 of a brand new follow-up form on one actual form.
 */
async function create_version_one(source_form_group_id, form_data) {
  const now = new Date();
  const document = Object.assign(version_fields(form_data), {
    follow_up_group_id: uuid_v4(),
    source_form_group_id,
    version: 1,
    is_active: true,
    created_by: form_data.created_by,
    created_by_name: form_data.created_by_name,
    updated_by: form_data.created_by,
    updated_by_name: form_data.created_by_name,
    created_at: now,
    updated_at: now,
  });
  const result = await collection().insertOne(document);
  return Object.assign({ _id: result.insertedId }, document);
}

/**
 * The next version of an existing follow-up; it becomes the active one and
 * every earlier version is left untouched but inactive.
 */
async function create_next_version(follow_up_group_id, form_data) {
  const latest = await get_latest(follow_up_group_id);
  if (!latest) return null;
  const now = new Date();
  const document = Object.assign(version_fields(form_data), {
    follow_up_group_id,
    source_form_group_id: latest.source_form_group_id,
    version: latest.version + 1,
    is_active: true,
    created_by: form_data.created_by,
    created_by_name: form_data.created_by_name,
    updated_by: form_data.created_by,
    updated_by_name: form_data.created_by_name,
    created_at: now,
    updated_at: now,
  });
  const result = await collection().insertOne(document);
  await collection().updateMany({ follow_up_group_id, version: { $ne: document.version } }, { $set: { is_active: false } });
  return Object.assign({ _id: result.insertedId }, document);
}

/**
 * Rewrites one version's own name, schema and respondent flag without
 * minting a new version - an edit that left the set of data fields alone.
 */
async function update_in_place(follow_up_group_id, version, form_data) {
  await collection().updateOne(
    { follow_up_group_id, version: Number(version) },
    {
      $set: {
        form_name: form_data.form_name,
        form_name_normalized: form_data.form_name_normalized,
        schema: form_data.schema,
        ask_respondent: form_data.ask_respondent !== false,
        updated_by: form_data.updated_by,
        updated_by_name: form_data.updated_by_name,
        updated_at: new Date(),
      },
    },
  );
  return get_version(follow_up_group_id, version);
}

/** Every version of a follow-up, newest first. */
async function get_versions(follow_up_group_id) {
  return collection().find({ follow_up_group_id }).sort({ version: -1 }).toArray();
}

/** The highest version document. */
async function get_latest(follow_up_group_id) {
  const versions = await collection().find({ follow_up_group_id }).sort({ version: -1 }).limit(1).toArray();
  return versions[0] || null;
}

/** The version the public link resolves to (the highest one flagged active). */
async function get_active(follow_up_group_id) {
  return collection().findOne({ follow_up_group_id, is_active: true }, { sort: { version: -1 } });
}

/** One named version. */
async function get_version(follow_up_group_id, version) {
  return collection().findOne({ follow_up_group_id, version: Number(version) });
}

/**
 * The follow-up of one actual form: its latest version document (which
 * carries the follow_up_group_id), or null when the form has none.
 */
async function get_by_group(source_form_group_id) {
  const versions = await collection().find({ source_form_group_id }).sort({ version: -1 }).limit(1).toArray();
  return versions[0] || null;
}

/** The active version of the follow-up of one actual form, or null. */
async function get_active_by_group(source_form_group_id) {
  return collection().findOne({ source_form_group_id, is_active: true }, { sort: { version: -1 } });
}

/** Marks one version active and every sibling inactive. */
async function set_active(follow_up_group_id, version) {
  await collection().updateMany({ follow_up_group_id }, { $set: { is_active: false } });
  await collection().updateOne({ follow_up_group_id, version: Number(version) }, { $set: { is_active: true } });
  return get_active(follow_up_group_id);
}

/** Removes one version document; the caller has already checked it may go. */
async function delete_version(follow_up_group_id, version) {
  const result = await collection().deleteOne({ follow_up_group_id, version: Number(version) });
  return result.deletedCount > 0;
}

/** Removes every follow-up form of a project - only while deleting the project itself. */
async function delete_by_project(project_id) {
  const result = await collection().deleteMany({ project_id: project_id.toString() });
  return result.deletedCount;
}

module.exports = {
  COLLECTION_NAME,
  create_version_one,
  create_next_version,
  update_in_place,
  get_versions,
  get_latest,
  get_active,
  get_version,
  get_by_group,
  get_active_by_group,
  set_active,
  delete_version,
  delete_by_project,
};
