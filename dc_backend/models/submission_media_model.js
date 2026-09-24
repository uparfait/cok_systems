const { get_db } = require("../db_connection/db.js");
const { apply_value_filters } = require("./submissions_model.js");

const COLLECTION_NAME = "dcs_submissions";

/**
 * The gallery reads one thing only: the pictures and the videos a form has
 * collected, newest first, as a flat list of their own rather than as
 * whole records. Paging over PICTURES (not over records) is why this is an
 * aggregation and not a find(): one record may carry several media
 * answers, and a record carrying none must not take up a slot in the grid.
 *
 * Only image and video answers are kept - audio, documents and signatures
 * have nothing to show in a grid of thumbnails. What counts as one is read
 * off the stored answer's own mime type, falling back to its file
 * extension for a pasted link, which carries no mime type at all.
 */

const IMAGE_VIDEO_MIME = /^(image|video)\//i;
const IMAGE_VIDEO_EXTENSION = /\.(jpe?g|png|gif|webp|bmp|avif|tiff?|svg|mp4|webm|mov|m4v|mkv|ogv|avi)(\?|#|$)/i;

/**
 * Turns the media field ids into the { field_id, value } pairs the
 * pipeline unwinds - built here rather than in $objectToArray so a field
 * that is not a media field can never reach the grid.
 */
function media_entries_expression(field_ids) {
  return field_ids.map((field_id) => ({ field_id, value: `$data.${field_id}` }));
}

function build_pipeline(form_group_id, field_ids, date_bounds, filters) {
  const match = { form_group_id };
  if (date_bounds && date_bounds.start && date_bounds.end) {
    match.submitted_at = { $gte: date_bounds.start, $lte: date_bounds.end };
  }
  apply_value_filters(match, filters);

  return [
    { $match: match },
    { $sort: { submitted_at: -1, _id: -1 } },
    { $project: { submitted_at: 1, version: 1, respondent: 1, entries: media_entries_expression(field_ids) } },
    { $unwind: "$entries" },
    // A field may hold one answer or a list of them; both continue as a list.
    {
      $addFields: {
        "entries.values": {
          $cond: [{ $isArray: "$entries.value" }, "$entries.value", [{ $ifNull: ["$entries.value", null] }]],
        },
      },
    },
    { $unwind: "$entries.values" },
    { $match: { "entries.values": { $ne: null } } },
    {
      $addFields: {
        media_url: {
          $cond: [
            { $eq: [{ $type: "$entries.values" }, "string"] },
            "$entries.values",
            { $ifNull: ["$entries.values.url", "$entries.values.data_url"] },
          ],
        },
        media_name: { $cond: [{ $eq: [{ $type: "$entries.values" }, "string"] }, null, "$entries.values.name"] },
        media_type: { $cond: [{ $eq: [{ $type: "$entries.values" }, "string"] }, null, "$entries.values.type"] },
      },
    },
    { $match: { media_url: { $type: "string", $ne: "" } } },
    {
      $match: {
        $or: [
          { media_type: IMAGE_VIDEO_MIME },
          { media_name: IMAGE_VIDEO_EXTENSION },
          { media_url: IMAGE_VIDEO_EXTENSION },
        ],
      },
    },
    {
      $facet: {
        items: [
          { $skip: 0 },
          {
            $project: {
              _id: 0,
              submission_id: "$_id",
              field_id: "$entries.field_id",
              url: "$media_url",
              name: "$media_name",
              type: "$media_type",
              version: 1,
              submitted_at: 1,
              respondent: 1,
            },
          },
        ],
        total_count: [{ $count: "count" }],
      },
    },
  ];
}

/**
 * One page of the gallery. field_ids are the form's own media fields,
 * resolved from its schemas by the caller.
 */
async function list_media_answers(form_group_id, field_ids, skip, limit, date_bounds, filters) {
  if (!field_ids || field_ids.length === 0) return { items: [], total: 0 };
  const pipeline = build_pipeline(form_group_id, field_ids, date_bounds, filters);
  const facet = pipeline[pipeline.length - 1].$facet;
  facet.items = [{ $skip: skip }, { $limit: limit }].concat(facet.items.slice(1));

  const [result] = await get_db().collection(COLLECTION_NAME).aggregate(pipeline, { allowDiskUse: true }).toArray();
  return {
    items: (result && result.items) || [],
    total: (result && result.total_count && result.total_count[0] && result.total_count[0].count) || 0,
  };
}

module.exports = { list_media_answers };
