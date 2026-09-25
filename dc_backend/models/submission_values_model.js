const { get_db } = require("../db_connection/db.js");
const { stage_prefilter, stage_rows_stages } = require("../utilities/tracking_window.js");

const COLLECTION_NAME = "dcs_submissions";
const MAX_VALUES = 200;

/**
 * A stored answer may be a string or a number depending on the field, so
 * an equality filter matches both spellings of the same value.
 */
function value_candidates(values) {
  const out = [];
  (values || []).forEach((value) => {
    if (value === undefined || value === null || value === "") return;
    out.push(value);
    const as_string = String(value);
    if (!out.includes(as_string)) out.push(as_string);
    const as_number = Number(value);
    if (Number.isFinite(as_number) && !out.includes(as_number)) out.push(as_number);
  });
  return out;
}

/**
 * The answers a single field has actually collected, each with how many
 * records carry it - what a choice column's own filter dropdown lists,
 * under the very date range the table shows.
 *
 * On a tracked form it counts STAGES, exactly as the table lists them: a
 * car recorded "in" at 12:00 and labelled "out" at 13:00 contributes one
 * to "in" and one to "out" for a range covering both (see
 * utilities/tracking_window.js). So every value the dropdown offers, and
 * every count beside it, is one the table can actually show. Any other
 * form counts what was submitted inside the range.
 *
 * parent (optional: { field_id, values }) narrows the count to the records
 * whose PARENT answer is one of the picked values, so a sector filter
 * under a picked district only counts that district's records.
 *
 * A multi-select answer is an array, so it is unwound first and each of
 * its picks counted on its own.
 */
async function list_field_values(form_group_id, field_id, date_bounds, parent, tracking) {
  const base = Object.assign({ form_group_id }, stage_prefilter(date_bounds, tracking));
  // Applied AFTER the stage rewrite, so the values counted are the values
  // the rows actually show.
  const answered = { [`data.${field_id}`]: { $exists: true, $nin: [null, ""] } };
  if (parent && parent.field_id && Array.isArray(parent.values) && parent.values.length > 0) {
    answered[`data.${parent.field_id}`] = { $in: value_candidates(parent.values) };
  }

  const rows = await get_db()
    .collection(COLLECTION_NAME)
    .aggregate(
      [
        { $match: base },
        ...stage_rows_stages(tracking, date_bounds),
        { $match: answered },
        { $project: { value: `$data.${field_id}` } },
        { $unwind: "$value" },
        { $match: { value: { $type: ["string", "double", "int", "long", "decimal", "bool"] } } },
        { $group: { _id: "$value", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: MAX_VALUES },
      ],
      { allowDiskUse: true },
    )
    .toArray();

  return rows.map((row) => ({ value: row._id, count: row.count }));
}

module.exports = { MAX_VALUES, list_field_values };
