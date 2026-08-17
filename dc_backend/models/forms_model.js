const { v4: uuid_v4 } = require("uuid");
const { get_db } = require("../db_connection/db.js");
const { to_object_id } = require("../utilities/object_id.js");

const COLLECTION_NAME = "dcs_forms";

/**
 * Creates version 1 of a brand new form under a project. form_group_id is
 * the stable identifier that never changes across versions, and is what
 * URLs like /dcs-form/:id and /dcs-system/project/forms/:form-id use.
 */
async function create_form_version_one(form_data) {
  const now = new Date();
  const document = Object.assign({}, form_data, {
    form_group_id: uuid_v4(),
    version: 1,
    is_active: true,
    created_at: now,
    updated_at: now,
  });
  const result = await get_db().collection(COLLECTION_NAME).insertOne(document);
  return Object.assign({ _id: result.insertedId }, document);
}

/**
 * Creates the next version of an existing form. The prior versions are
 * never modified or removed - versioning is append-only and immutable.
 */
async function create_next_form_version(form_group_id, form_data) {
  const latest = await get_latest_version(form_group_id);
  const next_version = latest ? latest.version + 1 : 1;
  const now = new Date();
  const document = Object.assign({}, form_data, {
    form_group_id,
    version: next_version,
    is_active: true,
    created_at: now,
    updated_at: now,
  });
  const result = await get_db().collection(COLLECTION_NAME).insertOne(document);

  await get_db()
    .collection(COLLECTION_NAME)
    .updateMany({ form_group_id, version: { $ne: next_version } }, { $set: { is_active: false } });

  return Object.assign({ _id: result.insertedId }, document);
}

/**
 * Updates the current version's own name/schema without minting a new
 * version - used when an edit only touches a field's condition, design,
 * label/help text, or a content (form design) component, never the set of
 * data-collection fields. version and created_by/created_at are never
 * touched; who last edited it is tracked separately via updated_by.
 */
async function update_version_in_place(form_group_id, version, form_data) {
  const now = new Date();
  await get_db()
    .collection(COLLECTION_NAME)
    .updateOne(
      { form_group_id, version: Number(version) },
      {
        $set: {
          form_name: form_data.form_name,
          form_name_normalized: form_data.form_name_normalized,
          schema: form_data.schema,
          updated_by: form_data.updated_by,
          updated_by_name: form_data.updated_by_name,
          updated_at: now,
        },
      },
    );
  return get_version_document(form_group_id, version);
}

/**
 * Returns every version of a form, newest first.
 */
async function get_versions_by_group(form_group_id) {
  return get_db().collection(COLLECTION_NAME).find({ form_group_id }).sort({ version: -1 }).toArray();
}

/**
 * Returns the highest version document for a form group.
 */
async function get_latest_version(form_group_id) {
  const versions = await get_db()
    .collection(COLLECTION_NAME)
    .find({ form_group_id })
    .sort({ version: -1 })
    .limit(1)
    .toArray();
  return versions[0] || null;
}

/**
 * True when another form (any other form_group_id) in the same project
 * already uses this name - form names must be unique per project so
 * authors can tell forms apart when listing them.
 */
async function is_form_name_taken(project_id, form_name, exclude_form_group_id) {
  const query = { project_id, form_name_normalized: form_name.trim().toLowerCase() };
  if (exclude_form_group_id) {
    query.form_group_id = { $ne: exclude_form_group_id };
  }
  const existing = await get_db().collection(COLLECTION_NAME).findOne(query);
  return !!existing;
}

/**
 * Returns whichever version is currently flagged as active for a form
 * group - this is the version that public data collection links resolve to.
 */
async function get_active_version(form_group_id) {
  return get_db().collection(COLLECTION_NAME).findOne({ form_group_id, is_active: true });
}

/**
 * Returns one specific, named version of a form group - this is what a
 * submission is validated and permanently linked against.
 */
async function get_version_document(form_group_id, version) {
  return get_db().collection(COLLECTION_NAME).findOne({ form_group_id, version: Number(version) });
}

/**
 * Returns a specific version document by its own identifier.
 */
async function get_form_by_document_id(document_id) {
  const object_id = to_object_id(document_id);
  if (!object_id) return null;
  return get_db().collection(COLLECTION_NAME).findOne({ _id: object_id });
}

/**
 * Returns one document per form group inside a project, using the latest
 * version of each group so titles stay current - forms are displayed as
 * links using form_group_id, never a table.
 */
async function get_latest_forms_by_project(project_id) {
  const latest_forms = await get_db()
    .collection(COLLECTION_NAME)
    .aggregate([
      { $match: { project_id } },
      { $sort: { version: -1 } },
      { $group: { _id: "$form_group_id", latest: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$latest" } },
      { $sort: { updated_at: -1 } },
    ])
    .toArray();
  return latest_forms;
}

/**
 * Returns the distinct form_group_id of every form (any version) that
 * belongs to a project - used when deleting a project so its collected
 * data can be removed too.
 */
async function get_form_group_ids_by_project(project_id) {
  return get_db().collection(COLLECTION_NAME).distinct("form_group_id", { project_id });
}

/**
 * Permanently removes every version of every form belonging to a project.
 * Only ever called as part of deleting the whole project itself - forms
 * are otherwise immutable and never deleted individually.
 */
async function delete_forms_by_project(project_id) {
  const result = await get_db().collection(COLLECTION_NAME).deleteMany({ project_id });
  return result.deletedCount;
}

/**
 * Permanently removes one specific version of a form. Never the active
 * version - callers must check is_active themselves before calling this,
 * since a form must always have exactly one active version.
 */
async function delete_version(form_group_id, version) {
  const result = await get_db()
    .collection(COLLECTION_NAME)
    .deleteOne({ form_group_id, version: Number(version) });
  return result.deletedCount > 0;
}

/**
 * Marks a specific version as the active one and deactivates every sibling
 * version in the same group.
 */
async function set_active_version(form_group_id, version) {
  await get_db()
    .collection(COLLECTION_NAME)
    .updateMany({ form_group_id }, { $set: { is_active: false } });
  await get_db()
    .collection(COLLECTION_NAME)
    .updateOne({ form_group_id, version: Number(version) }, { $set: { is_active: true } });
  return get_active_version(form_group_id);
}

module.exports = {
  create_form_version_one,
  create_next_form_version,
  update_version_in_place,
  is_form_name_taken,
  get_versions_by_group,
  get_latest_version,
  get_active_version,
  get_version_document,
  get_form_by_document_id,
  get_latest_forms_by_project,
  get_form_group_ids_by_project,
  delete_forms_by_project,
  delete_version,
  set_active_version,
};
