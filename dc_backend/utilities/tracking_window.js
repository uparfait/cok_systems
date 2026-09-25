/**
 * Which records a picked date range keeps.
 *
 * An UNTRACKED form is answered once and never changed, so the only date
 * its records carry is submitted_at: a range keeps what arrived inside it.
 *
 * A TRACKED form is a register whose records go on being updated (see
 * utilities/tracking.js), so submitted_at is the wrong date to read - it
 * would hide a record recorded years ago and corrected this morning, which
 * is the very thing a register exists to show. Such a record is dated by
 * its tracking_periods instead: every period of every updatable field
 * carries the moment its value OPENED, so a range keeps every record whose
 * values opened inside it - the ones created in the range, plus the ones
 * changed in the range.
 */

/**
 * Every moment at which one of a record's tracked values opened, flattened
 * across all of its updatable fields. tracking_periods is
 * { <field id>: [{ value, from, to }] }, and "from" is that moment: the
 * record's own submission for a first period, the instant of the change
 * for each one after it.
 */
const OPENED_MOMENTS = {
  $reduce: {
    input: { $objectToArray: { $ifNull: ["$tracking_periods", {}] } },
    initialValue: [],
    in: {
      $concatArrays: [
        "$$value",
        { $map: { input: { $ifNull: ["$$this.v", []] }, as: "period", in: "$$period.from" } },
      ],
    },
  },
};

/** One moment inside [start, end]; an absent moment is never inside it. */
function within(moment, start, end) {
  return {
    $and: [
      { $ne: [moment, null] },
      { $gte: [moment, start] },
      { $lte: [moment, end] },
    ],
  };
}

/**
 * The date condition to merge into a submissions query for one form.
 * Returns {} for an unbounded range ("all"), so a caller can always merge
 * it unconditionally.
 *
 * A tracked record with NO tracking_periods at all has no opened moment to
 * read - it was collected before the form was tracked, or the form tracks
 * no updatable field - so it falls back to its own arrival date instead of
 * dropping out of every dated view.
 *
 * On the tracked branch submitted_at <= end rides along purely so the
 * { form_group_id: 1, submitted_at: -1 } index stays usable: every opened
 * moment is at or after the record's own submission, so a record holding
 * one inside the window always satisfies it and no row is lost to it.
 */
function date_window_filter(bounds, tracking) {
  if (!bounds || !bounds.start || !bounds.end) return {};

  if (!tracking || tracking.enabled !== true) {
    return { submitted_at: { $gte: bounds.start, $lte: bounds.end } };
  }

  return {
    submitted_at: { $lte: bounds.end },
    $expr: {
      $let: {
        vars: { opened: OPENED_MOMENTS },
        in: {
          $cond: [
            { $eq: [{ $size: "$$opened" }, 0] },
            within("$submitted_at", bounds.start, bounds.end),
            {
              $anyElementTrue: {
                $map: { input: "$$opened", as: "at", in: within("$$at", bounds.start, bounds.end) },
              },
            },
          ],
        },
      },
    },
  };
}

module.exports = { date_window_filter };
