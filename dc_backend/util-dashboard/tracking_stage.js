/**
 * Every reader of a TRACKED form - the tables, the exports, the data feed,
 * the dashboards - reads every updatable field AS IT STOOD at the end of
 * the selected window, not as it stands today: a reading of "the 12:00
 * hour" says the car was in, even though it has since left (see
 * utilities/tracking_window.js, which wraps this as as_of_stages).
 *
 * Each record keeps, per updatable field, the periods its value held
 * (tracking_periods.<field>: [{ value, from, to }], the open one with
 * to: null - see utilities/tracking.js). This stage rewrites data.<field>
 * to the value of the period covering the window's end, so whatever
 * follows simply reads data.<field> as usual. A record with no periods
 * for the field (it was tracked before the field became updatable) keeps
 * its stored answer. Without an end date (window "all", a feed's ?since)
 * nothing is rewritten: today's value is the value.
 */

function value_at(field_id, at) {
  const periods = { $ifNull: [`$tracking_periods.${field_id}`, []] };
  const covering = {
    $filter: {
      input: periods,
      as: "period",
      cond: {
        $and: [
          { $lte: ["$$period.from", at] },
          { $or: [{ $eq: ["$$period.to", null] }, { $not: ["$$period.to"] }, { $gt: ["$$period.to", at] }] },
        ],
      },
    },
  };
  return {
    $let: {
      vars: { hit: covering },
      in: {
        $cond: [
          { $gt: [{ $size: "$$hit" }, 0] },
          { $arrayElemAt: [{ $map: { input: "$$hit", as: "entry", in: "$$entry.value" } }, 0] },
          `$data.${field_id}`,
        ],
      },
    },
  };
}

/**
 * The stages to place right after a reader's opening $match. Empty for an
 * untracked form, a window without an end, or a tracking config with no
 * updatable field. The caller passes { tracking }.
 */
function tracking_stages(widget, bounds) {
  const tracking = widget && widget.tracking;
  if (!tracking || tracking.enabled !== true || !bounds || !bounds.end) return [];
  const fields = Array.isArray(tracking.editable_field_ids) ? tracking.editable_field_ids : [];
  if (fields.length === 0) return [];
  const set = {};
  fields.forEach((field_id) => {
    set[`data.${field_id}`] = value_at(field_id, bounds.end);
  });
  return [{ $addFields: set }];
}

module.exports = { tracking_stages, value_at };
