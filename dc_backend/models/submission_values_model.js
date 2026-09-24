const { get_db } = require("../db_connection/db.js");

const COLLECTION_NAME = "dcs_submissions";
const MAX_VALUES = 200;

/**
 * The answers a single field has actually collected, each with how many
 * records carry it - what a choice column's own filter dropdown lists.
 * Read from the data rather than from the schema on purpose: an option
 * renamed or dropped in a later version still has records behind it, and
 * a column nobody ever answered has nothing to offer to filter by.
 *
 * A multi-select answer is an array, so it is unwound first and each of
 * its picks counted on its own.
 */
async function list_field_values(form_group_id, field_id, date_bounds) {
  const match = { form_group_id, [`data.${field_id}`]: { $exists: true, $nin: [null, ""] } };
  if (date_bounds && date_bounds.start && date_bounds.end) {
    match.submitted_at = { $gte: date_bounds.start, $lte: date_bounds.end };
  }

  const rows = await get_db()
    .collection(COLLECTION_NAME)
    .aggregate(
      [
        { $match: match },
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
