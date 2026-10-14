/**
 * What a picked date range means, for a tracked form and an ordinary one.
 *
 * An UNTRACKED form is answered once and never changed. Its record has a
 * single moment - it arrived - so a range keeps what arrived inside it,
 * and every surface buckets, sorts and windows on submitted_at.
 *
 * A TRACKED form is a register whose records go on being updated (see
 * utilities/tracking.js). The tables and the dashboards read its CURRENT
 * state: one row per record, carrying the answers it holds today, and
 * dated by the moment it LAST MOVED - the last update, or the arrival of
 * a record never updated:
 *
 *   last_moved_at = ifNull(updated_at, submitted_at)
 *
 * A range keeps the records whose last move falls inside it (created or
 * last updated in the window), an over-time chart puts each record in the
 * bucket of its last move, and a KPI window counts the records that last
 * moved inside it with the value they hold now. Because every surface
 * reads the same moment, the table, the charts and the KPI cards cannot
 * drift apart. A tracked form that declares no updatable field never
 * moves after arrival, so it reads exactly like an untracked one.
 *
 * The export and the data feed keep their own reading (date_window_filter
 * below): one line per record that was created OR changed at any moment
 * inside the window, carrying the value it held at the window's end.
 */

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
 * The moment a row stands for, as an aggregation expression: the last
 * move on a register, the arrival on any other form.
 */
function last_moved_expr(tracking) {
  return is_updatable(tracking) ? { $ifNull: ["$updated_at", "$submitted_at"] } : "$submitted_at";
}

function range_of(bounds) {
  const range = {};
  if (bounds && bounds.start) range.$gte = bounds.start;
  if (bounds && bounds.end) range.$lte = bounds.end;
  return range;
}

/**
 * The record-level date condition of the tables and the dashboards: the
 * records whose last move falls inside the window. A plain query (no
 * $expr), so it serves find() and $match alike and the indexes on
 * submitted_at and updated_at stay in play. Either bound may be absent;
 * {} for a window with no bounds at all ("all"), so a caller can always
 * merge it unconditionally.
 *
 * Untracked: submitted_at inside the window. Tracked: updated_at inside
 * the window, or no updated_at yet and submitted_at inside it.
 */
function window_filter(bounds, tracking) {
  const range = range_of(bounds);
  if (Object.keys(range).length === 0) return {};
  if (!is_updatable(tracking)) return { submitted_at: range };
  return { $or: [{ updated_at: range }, { updated_at: null, submitted_at: range }] };
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
 * The RECORD-level date condition of the export and the data feed: keeps
 * a record when any of its moments falls inside the window. One line per
 * car, however many times it moved.
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

module.exports = {
  updatable_fields,
  is_updatable,
  last_moved_expr,
  window_filter,
  date_window_filter,
};
