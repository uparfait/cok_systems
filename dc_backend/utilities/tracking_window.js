const { value_at, tracking_stages } = require("../util-dashboard/tracking_stage.js");

/**
 * What a picked date range means, for a tracked form and an ordinary one.
 * ONE rule, shared by every reader - the data tables, the exports, the
 * data feed, every dashboard widget (signed-in or through a share link),
 * the records behind a widget, the filter values:
 *
 * An UNTRACKED form (or a tracked one with no updatable field) is answered
 * once and never changed. Its record has a single moment - it arrived -
 * so a range keeps what arrived inside it, with the values as stored.
 *
 * A TRACKED form is a register whose records go on being updated (see
 * utilities/tracking.js), each update a STAGE of the same record. A
 * reader asked for a period shows the data AS IT WAS AT THE END of that
 * period:
 *
 *   membership  a record is kept when it was created or changed at any
 *               moment inside [start, end] (date_window_filter);
 *   values      every updatable field reads the value it held at `end`
 *               (as_of_stages: value_at on the period covering `end`),
 *               so a status "alive" until 13:50 and "dead" from 13:51
 *               reads "alive" for a period ending 13:30. submitted_at
 *               stays the creation time; the tables add as_of = end.
 *
 * No period, or a period ending now or later: today's values - there is
 * nothing to rewrite, the open period holds the value.
 *
 * Over-time widgets (and the submissions-over-time chart) read the state
 * DURING each bucket instead: one row per stage moment inside the window,
 * carrying the values at that moment (stage_rows_stages), bucketed by the
 * moment - a car "in" at 12:00 and "out" at 13:00 counts in both columns.
 */

const STAGE_AT = "stage_at";
const MOMENTS_FIELD = "dcs_stage_moments";

/** The updatable fields of a tracking config, or [] when it tracks none. */
function updatable_fields(tracking) {
  if (!tracking || tracking.enabled !== true) return [];
  return Array.isArray(tracking.editable_field_ids) ? tracking.editable_field_ids : [];
}

/** Whether a form's records can move after arrival at all. */
function is_updatable(tracking) {
  return updatable_fields(tracking).length > 0;
}

/**
 * Every moment at which one of a record's tracked values opened, across
 * all of its updatable fields. tracking_periods is
 * { <field id>: [{ value, from, to }] } and "from" is that moment: the
 * record's own submission for a first period, the instant of the change
 * for each one after it.
 *
 * $setUnion drops duplicates, so a single change that moved two fields at
 * once is ONE moment rather than two identical ones.
 *
 * A record carrying no periods at all - collected before the form was
 * tracked - has only ever had one moment, so its arrival stands in as its
 * single moment instead of it dropping out of every dated reading.
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
 * The MEMBERSHIP of a window: keeps a record when any of its moments falls
 * inside it. Either bound may be absent, which the feed relies on: its
 * ?since is a start with no end, and on a tracked form that then reads as
 * "created or changed since", so a corrected record is delivered again
 * instead of the reader keeping the value it first saw forever.
 *
 * Returns {} for a window with no bounds at all ("all"), so a caller can
 * always merge it unconditionally. A plain query apart from the $expr, so
 * it serves find() and $match alike.
 */
function date_window_filter(bounds, tracking) {
  const start = (bounds && bounds.start) || null;
  const end = (bounds && bounds.end) || null;
  if (!start && !end) return {};

  const submitted_at = {};
  if (start) submitted_at.$gte = start;
  if (end) submitted_at.$lte = end;

  // No updatable field means the arrival is the only moment there is to test.
  const field_ids = updatable_fields(tracking);
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
  // Every moment happens at or after the record's submission, so an upper
  // bound on submitted_at can never drop a record that has a moment inside
  // the window - and it keeps the index in play. A lower bound cannot be
  // used: a car recorded last year and driven out today has to survive.
  if (end) filter.submitted_at = { $lte: end };
  return filter;
}

/**
 * The AS-OF rewrite of a window: every updatable field set to the value it
 * held at the window's end (see util-dashboard/tracking_stage.js). Empty
 * for an untracked form, a window without an end, or one ending now or
 * later - today's value is then already the value.
 */
function as_of_stages(tracking, bounds) {
  if (!is_updatable(tracking) || !bounds || !bounds.end) return [];
  if (new Date(bounds.end).getTime() >= Date.now()) return [];
  return tracking_stages({ tracking }, bounds);
}

/**
 * The moment a record reached the state a window shows - the last of its
 * moments at or before the window's end (its last move with no end, its
 * arrival on an untracked form). What per-day statistics group on.
 */
function state_moment_expr(tracking, bounds) {
  const field_ids = updatable_fields(tracking);
  if (field_ids.length === 0) return "$submitted_at";
  const end = bounds && bounds.end ? new Date(bounds.end) : null;
  if (!end) return { $ifNull: ["$updated_at", "$submitted_at"] };
  const before_end = { $filter: { input: opened_moments(field_ids), as: "moment", cond: { $lte: ["$$moment", end] } } };
  return { $ifNull: [{ $max: before_end }, "$submitted_at"] };
}

/** When a register's record last moved, as an expression: its last update, or its arrival. */
function last_moved_expr(tracking) {
  return is_updatable(tracking) ? { $ifNull: ["$updated_at", "$submitted_at"] } : "$submitted_at";
}

// ---- The over-time reading: one row per stage moment ----------------------

/**
 * The cheap condition for the opening $match of a stage pipeline, so the
 * { form_group_id, submitted_at } index narrows the scan before any stage
 * is built. Untracked: both bounds. Tracked: the upper bound only - every
 * stage happens at or after the submission, and a car recorded last year
 * and driven out today has to survive to be expanded.
 */
function stage_prefilter(bounds, tracking) {
  if (!bounds || !bounds.start || !bounds.end) return {};
  if (!is_updatable(tracking)) return { submitted_at: { $gte: bounds.start, $lte: bounds.end } };
  return { submitted_at: { $lte: bounds.end } };
}

/** The field an over-time bucket reads: the stage moment on a register, the arrival otherwise. */
function time_field(tracking) {
  return is_updatable(tracking) ? STAGE_AT : "submitted_at";
}

/** The same thing as an aggregation expression. */
function time_expr(tracking) {
  return `$${time_field(tracking)}`;
}

/**
 * The stages expanding each record into one row per stage moment inside
 * the window, every updatable field rewritten to its value AT that
 * moment. Empty for a form with no stages, whose opening $match already
 * describes the window completely.
 */
function stage_rows_stages(tracking, bounds) {
  const field_ids = updatable_fields(tracking);
  if (field_ids.length === 0) return [];

  const at_moment = {};
  field_ids.forEach((field_id) => {
    at_moment[`data.${field_id}`] = value_at(field_id, `$${STAGE_AT}`);
  });

  const in_range = bounds && bounds.start && bounds.end ? [{ $match: { [STAGE_AT]: { $gte: bounds.start, $lte: bounds.end } } }] : [];

  return [
    { $addFields: { [MOMENTS_FIELD]: opened_moments(field_ids) } },
    { $unwind: `$${MOMENTS_FIELD}` },
    { $addFields: { [STAGE_AT]: `$${MOMENTS_FIELD}` } },
    // Narrowed before the values are rewritten: the rewrite is the
    // expensive part and only surviving stages need it.
    ...in_range,
    { $addFields: at_moment },
    { $project: { [MOMENTS_FIELD]: 0 } },
  ];
}

module.exports = {
  STAGE_AT,
  updatable_fields,
  is_updatable,
  date_window_filter,
  as_of_stages,
  state_moment_expr,
  last_moved_expr,
  stage_prefilter,
  time_field,
  time_expr,
  stage_rows_stages,
};
