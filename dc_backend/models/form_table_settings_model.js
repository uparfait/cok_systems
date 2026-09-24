const { get_db } = require("../db_connection/db.js");

const COLLECTION_NAME = "dcs_form_table_settings";
const MAX_HIDDEN_COLUMNS = 500;

/**
 * How a form's data TABLE is shown, for everybody who opens it. A form
 * document is versioned and immutable, so this lives in its own small
 * collection keyed by the stable form_group_id instead: one row per form,
 * holding the column keys that are currently ticked off in "Hide fields".
 *
 * A hidden column is hidden for every user until it is unticked again -
 * this is a property of the form's table, not a per-browser preference,
 * which is exactly why it is stored here rather than in localStorage.
 */

const collection = () => get_db().collection(COLLECTION_NAME);

/** The column keys a form currently hides; an empty list when nothing is set. */
async function get_hidden_columns(form_group_id) {
  const document = await collection().findOne({ form_group_id: String(form_group_id) });
  return document && Array.isArray(document.hidden_columns) ? document.hidden_columns : [];
}

/** Replaces the whole hidden set in one write, deduped and capped. */
async function save_hidden_columns(form_group_id, hidden_columns, user) {
  const unique = Array.from(new Set((hidden_columns || []).filter((key) => typeof key === "string" && key.trim()))).slice(0, MAX_HIDDEN_COLUMNS);
  await collection().updateOne(
    { form_group_id: String(form_group_id) },
    {
      $set: {
        hidden_columns: unique,
        updated_at: new Date(),
        updated_by: user && user.email ? user.email : null,
      },
      $setOnInsert: { form_group_id: String(form_group_id) },
    },
    { upsert: true },
  );
  return unique;
}

module.exports = {
  MAX_HIDDEN_COLUMNS,
  get_hidden_columns,
  save_hidden_columns,
};
