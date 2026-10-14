const { seed_baseline } = require("./tracking.js");

/**
 * CORRECTING THE PAST of a tracked record: an edit made "as of" a moment
 * rewrites what the record said at that moment instead of adding a new
 * change at now.
 *
 * For every changed updatable field the period holding as_of (from <=
 * as_of < to, or the open one) takes the new value - its bounds and every
 * later period stay as they are - and the history is kept consistent: the
 * entry recorded at that period's start gets its `to` for the field
 * rewritten, the entry at the period's end gets its `from` rewritten. The
 * open period being corrected means the record's current answer changes
 * too, and only then does updated_at move. A field that is not updatable
 * has one value and no periods: it simply takes the new one. One history
 * entry of kind "corrected" records it all, with as_of and, per change,
 * the start of the period it corrected (null for a plain field).
 *
 * The as-of readers (tables, dashboards, exports, the feed) need nothing
 * more: they read the periods, which now hold the corrected values.
 */

const same_moment = (a, b) => a && b && new Date(a).getTime() === new Date(b).getTime();

/** The period of a field holding a moment: the one covering it, else the first (a moment before the record) or the last. */
function period_holding(periods, at) {
  const list = Array.isArray(periods) ? periods : [];
  if (list.length === 0) return null;
  const moment = new Date(at).getTime();
  const covering = list.find((period) => new Date(period.from).getTime() <= moment && (period.to === null || period.to === undefined || new Date(period.to).getTime() > moment));
  if (covering) return covering;
  return moment < new Date(list[0].from).getTime() ? list[0] : list[list.length - 1];
}

/**
 * The record's answers as they stood at a moment: every updatable field
 * reads the period holding the moment, every other field its stored
 * value. The baseline is seeded first, so a record collected before the
 * form tracked it reads its initial state.
 */
function values_as_of(tracking, record, at) {
  const baseline = seed_baseline(tracking, record);
  const data = Object.assign({}, record.data || {});
  (tracking.editable_field_ids || []).forEach((field_id) => {
    const period = period_holding(baseline.tracking_periods[field_id], at);
    if (period) data[field_id] = period.value === undefined ? null : period.value;
  });
  return { data, baseline };
}

function is_open(period) {
  return period.to === null || period.to === undefined;
}

/** Rewrites, in place, the `to` of the entry at `at` and the `from` of the entry at `next_at` for one field. */
function rewrite_history(history, field_id, at, next_at, value) {
  history.forEach((entry) => {
    (entry.changes || []).forEach((change) => {
      if (change.field_id !== field_id) return;
      if (same_moment(entry.at, at)) change.to = value;
      if (next_at && same_moment(entry.at, next_at)) change.from = value;
    });
  });
}

/**
 * Applies the corrections. `changes` are the differences between the
 * values as of the moment and the corrected answers ([{ field_id, from,
 * to }]). Returns { data, tracking_periods, history, updated_at,
 * open_changed } ready for apply_record_update, the "corrected" entry
 * already appended.
 */
function apply_correction(tracking, record, baseline, changes, as_of, now, by) {
  const editable = new Set(tracking.editable_field_ids || []);
  const data = Object.assign({}, record.data || {});
  const tracking_periods = {};
  Object.keys(baseline.tracking_periods).forEach((field_id) => {
    tracking_periods[field_id] = baseline.tracking_periods[field_id].map((period) => Object.assign({}, period));
  });
  const history = baseline.history.map((entry) => Object.assign({}, entry, { changes: (entry.changes || []).map((change) => Object.assign({}, change)) }));
  let open_changed = false;
  const recorded = [];

  changes.forEach((change) => {
    if (!editable.has(change.field_id)) {
      data[change.field_id] = change.to;
      recorded.push({ field_id: change.field_id, from: change.from, to: change.to, at: null });
      return;
    }
    const period = period_holding(tracking_periods[change.field_id], as_of);
    period.value = change.to;
    if (is_open(period)) {
      data[change.field_id] = change.to;
      open_changed = true;
    }
    rewrite_history(history, change.field_id, period.from, is_open(period) ? null : period.to, change.to);
    recorded.push({ field_id: change.field_id, from: change.from, to: change.to, at: period.from });
  });

  history.push({ at: now, kind: "corrected", by, as_of, changes: recorded });
  return { data, tracking_periods, history, updated_at: open_changed ? now : record.updated_at || null, open_changed };
}

module.exports = { period_holding, values_as_of, apply_correction };
