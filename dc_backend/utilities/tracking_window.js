const { value_at } = require("../util-dashboard/tracking_stage.js");

/**
 * What a picked date range means, for a tracked form and an ordinary one.
 *
 * An UNTRACKED form is answered once and never changed. Its record has a
 * single moment - it arrived - so a range keeps what arrived inside it.
 *
 * A TRACKED form is a register whose records go on being updated (see
 * utilities/tracking.js), and each update is a STAGE of the same record.
 * A parking form is the plain case: a car is recorded at 12:00 with
 * status "in", and the same record is labelled "out" at 13:00. That is one
 * record but two stages, and every reading of the data has to see both -
 * "cars in" and "cars out" are each counting one of them, over the very
 * same hours.
 *
 * So the unit of reading is the STAGE, not the record:
 *
 *   stage_at   the moment the stage opened - 12:00 for the arrival, 13:00
 *              for the change. For an untracked form it is submitted_at.
 *   data.<f>   every tracked field's value AS OF stage_at - "in" on the
 *              12:00 stage, "out" on the 13:00 one.
 *
 * A range keeps the stages whose stage_at falls inside it, so the 12:00
 * range shows the car arriving and the 13:00 range shows it leaving.
 * Because stage_at is what every surface buckets, filters and counts on,
 * the table, the charts and the KPI cards cannot drift apart.
 *
 * Two shapes are built from this:
 *
 *   stage_rows_stages()  expands a record into one row per stage. Used
 *                        wherever each stage has to be seen on its own -
 *                        the data table, the gallery, every dashboard
 *                        widget, the KPI cards, the over-time charts.
 *
 *   date_window_filter() keeps one row per RECORD, namely the records
 *                        that have a stage inside the range. Used by the
 *                        export and the data feed, which deliberately
 *                        send no history: one line per car, carrying the
 *                        value it held at the end of the range.
 */

const STAGE_AT = "stage_at";
const MOMENTS_FIELD = "dcs_stage_moments";

/**
 * Every moment at which one of a record's tracked values opened, across
 * all of its updatable fields. tracking_periods is
 * { <field id>: [{ value, from, to }] } and "from" is that moment: the
 * record's own submission for a first period, the instant of the change
 * for each one after it.
 *
 * $setUnion drops duplicates, so a single change that moved two fields at
 * once is ONE stage rather than two identical ones.
 *
 * A record carrying no periods at all - collected before the form was
 * tracked - has only ever had one moment, so its arrival stands in as its
 * single stage instead of it dropping out of every dated reading.
 */
function opened_moments(field_ids) {
  const per_field = field_ids.map((field_id) => ({
    $map: { input: { $ifNull: [`$tracking_periods.${field_id}`, []] }, as: "period", in: "$$period.from" },
  }));
  return {
    $let: {
      vars: {
        opened: { $filter: { input: { $setUnion: per_field }, as: "moment", cond: { $ne: ["$$moment", null] } } },
      },
      in: { $cond: [{ $eq: [{ $size: "$$opened" }, 0] }, ["$submitted_at"], "$$opened"] },
    },
  };
}

/**
 * A cheap equality/range condition to put in a pipeline's opening $match so
 * the { form_group_id: 1, submitted_at: -1 } index still narrows the scan
 * before any stage is built.
 *
 * Untracked: both bounds, since the record's only stage IS its arrival.
 * Tracked: the upper bound only. Every stage of a record happens at or
 * after its submission, so a record holding a stage inside the range
 * always satisfies submitted_at <= end and none is lost to it. The lower
 * bound cannot be used here - a car recorded last year and driven out
 * today has to survive to be expanded.
 */
function stage_prefilter(bounds, tracking) {
  if (!bounds || !bounds.start || !bounds.end) return {};
  if (!is_staged(tracking)) {
    return { submitted_at: { $gte: bounds.start, $lte: bounds.end } };
  }
  return { submitted_at: { $lte: bounds.end } };
}

/** The updatable fields of a tracking config, or [] when it tracks none. */
function staged_fields(tracking) {
  if (!tracking || tracking.enabled !== true) return [];
  return Array.isArray(tracking.editable_field_ids) ? tracking.editable_field_ids : [];
}

/**
 * Whether a form's records have stages at all. False for an untracked
 * form, and for a tracked one that declares no updatable field: nothing
 * can ever open a second stage there, so its record IS its own single
 * stage and the plain submitted_at reading is already right.
 */
function is_staged(tracking) {
  return staged_fields(tracking).length > 0;
}

/**
 * The field carrying "when" for one form, which is what every surface must
 * bucket, sort and window on: the stage moment where there are stages, the
 * arrival otherwise. Having one answer to this is what keeps the table,
 * the charts and the KPI cards from drifting apart.
 */
function time_field(tracking) {
  return is_staged(tracking) ? STAGE_AT : "submitted_at";
}

/** The same thing as an aggregation expression. */
function time_expr(tracking) {
  return `$${time_field(tracking)}`;
}

/**
 * The stages to place directly after that opening $match, expanding each
 * record into one row per stage and rewriting every tracked field to its
 * value at that stage.
 *
 * Empty for a form with no stages - there the opening $match already
 * describes the range completely, so the caller keeps its plain find().
 */
function stage_rows_stages(tracking, bounds) {
  const field_ids = staged_fields(tracking);
  if (field_ids.length === 0) return [];

  const as_of_stage = {};
  field_ids.forEach((field_id) => {
    as_of_stage[`data.${field_id}`] = value_at(field_id, `$${STAGE_AT}`);
  });

  const in_range =
    bounds && bounds.start && bounds.end
      ? [{ $match: { [STAGE_AT]: { $gte: bounds.start, $lte: bounds.end } } }]
      : [];

  return [
    { $addFields: { [MOMENTS_FIELD]: opened_moments(field_ids) } },
    { $unwind: `$${MOMENTS_FIELD}` },
    { $addFields: { [STAGE_AT]: `$${MOMENTS_FIELD}` } },
    // Narrowed before the values are rewritten: the rewrite is the
    // expensive part and only surviving stages need it.
    ...in_range,
    { $addFields: as_of_stage },
    { $project: { [MOMENTS_FIELD]: 0 } },
  ];
}

/**
 * The RECORD-level date condition, for the export and the data feed: keeps
 * a record when any of its stages falls inside the window, without
 * expanding it. One line per car, however many times it moved.
 *
 * Either bound may be absent, which the feed relies on: its ?since is a
 * start with no end, and on a tracked form that then reads as "created or
 * changed since", so a corrected record is delivered again instead of the
 * reader keeping the value it first saw forever.
 *
 * Returns {} for a window with no bounds at all ("all"), so a caller can
 * always merge it unconditionally.
 */
function date_window_filter(bounds, tracking) {
  const start = (bounds && bounds.start) || null;
  const end = (bounds && bounds.end) || null;
  if (!start && !end) return {};

  const submitted_at = {};
  if (start) submitted_at.$gte = start;
  if (end) submitted_at.$lte = end;

  // No stages means the arrival is the only moment there is to test.
  const field_ids = staged_fields(tracking);
  if (field_ids.length === 0) return { submitted_at };

  const within = (moment) => {
    const conditions = [{ $ne: [moment, null] }];
    if (start) conditions.push({ $gte: [moment, start] });
    if (end) conditions.push({ $lte: [moment, end] });
    return { $and: conditions };
  };

  const filter = {
    $expr: {
      $let: {
        vars: { opened: opened_moments(field_ids) },
        in: { $anyElementTrue: { $map: { input: "$$opened", as: "at", in: within("$$at") } } },
      },
    },
  };
  // Every stage happens at or after the record's submission, so an upper
  // bound on submitted_at can never drop a record that has a stage inside
  // the window - and it keeps the index in play. A lower bound cannot be
  // used: a car recorded last year and driven out today has to survive.
  if (end) filter.submitted_at = { $lte: end };
  return filter;
}

module.exports = {
  STAGE_AT,
  is_staged,
  time_field,
  time_expr,
  stage_prefilter,
  stage_rows_stages,
  date_window_filter,
};
