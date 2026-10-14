const { get_db } = require("../db_connection/db.js");
const { apply_value_filters } = require("./submissions_model.js");
const { STAGE_AT, time_field, stage_prefilter, stage_rows_stages } = require("../utilities/tracking_window.js");

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

/**
 * The rows of one SIDE of the gallery: { collection, match, field_ids,
 * date_bounds, filters, tracking, source, follow_up_group_id }. A form's
 * own records are one side; its follow-up's records are another, read
 * from their own collection and tagged so a tile knows which table it
 * opens. Every row carries sort_at and its position inside its record,
 * so several sides can be ordered together after a $unionWith.
 */
function side_stages(side) {
  const { field_ids, date_bounds, filters, tracking } = side;
  const match = Object.assign({}, side.match, stage_prefilter(date_bounds, tracking));
  const value_filter = {};
  apply_value_filters(value_filter, filters);
  const has_value_filter = Object.keys(value_filter).length > 0;

  return [
    { $match: match },
    // The same stages the table lists, so a picture belongs to the moment
    // it was the record's answer. An image field that a later stage
    // replaced shows the old picture on the old stage and the new one on
    // the new stage, instead of today's picture standing in for both.
    ...stage_rows_stages(tracking, date_bounds),
    // After the rewrite, so a filter matches the values of that stage.
    ...(has_value_filter ? [{ $match: value_filter }] : []),
    { $sort: { [time_field(tracking)]: -1, _id: -1 } },
    { $project: { submitted_at: 1, [STAGE_AT]: 1, version: 1, respondent: 1, entries: media_entries_expression(field_ids) } },
    { $unwind: { path: "$entries", includeArrayIndex: "entry_index" } },
    // A field may hold one answer or a list of them; both continue as a list.
    {
      $addFields: {
        "entries.values": {
          $cond: [{ $isArray: "$entries.value" }, "$entries.value", [{ $ifNull: ["$entries.value", null] }]],
        },
      },
    },
    { $unwind: { path: "$entries.values", includeArrayIndex: "value_index" } },
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
        source: { $literal: side.source || "form" },
        // A missing path projects to nothing: a form's own row carries no
        // follow_up_group_id at all, and the controller reads that as null.
        follow_up_group_id: side.follow_up_group_id ? { $literal: side.follow_up_group_id } : "$follow_up_group_id",
        sort_at: `$${time_field(tracking)}`,
        entry_index: 1,
        value_index: 1,
      },
    },
  ];
}

/**
 * One page of media over one or several sides (see side_stages). The
 * first side is read directly and every other one joins it through
 * $unionWith; with more than one side the rows are ordered together
 * (newest first, then by their place inside their record) before the
 * page is cut, so a form's pictures and its follow-up's pictures
 * interleave by date instead of one source coming before the other.
 */
async function list_media(sides, skip, limit) {
  const live = (sides || []).filter((side) => side && Array.isArray(side.field_ids) && side.field_ids.length > 0);
  if (live.length === 0) return { items: [], total: 0 };
  const [first, ...others] = live;
  const pipeline = side_stages(first).concat(
    others.map((side) => ({ $unionWith: { coll: side.collection, pipeline: side_stages(side) } })),
    others.length > 0 ? [{ $sort: { sort_at: -1, submission_id: -1, entry_index: 1, value_index: 1 } }] : [],
    [
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }, { $project: { sort_at: 0, entry_index: 0, value_index: 0 } }],
          total_count: [{ $count: "count" }],
        },
      },
    ],
  );

  const [result] = await get_db().collection(first.collection).aggregate(pipeline, { allowDiskUse: true }).toArray();
  return {
    items: (result && result.items) || [],
    total: (result && result.total_count && result.total_count[0] && result.total_count[0].count) || 0,
  };
}

/** The form's own side of the gallery, as list_media reads it. */
function form_media_side(form_group_id, field_ids, date_bounds, filters, tracking) {
  return { collection: COLLECTION_NAME, match: { form_group_id }, field_ids, date_bounds, filters, tracking, source: "form", follow_up_group_id: null };
}

/**
 * One page of the gallery. field_ids are the form's own media fields,
 * resolved from its schemas by the caller.
 */
async function list_media_answers(form_group_id, field_ids, skip, limit, date_bounds, filters, tracking) {
  return list_media([form_media_side(form_group_id, field_ids, date_bounds, filters, tracking)], skip, limit);
}

module.exports = { list_media_answers, list_media, form_media_side };
