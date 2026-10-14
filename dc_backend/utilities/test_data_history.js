const { validate_submission_data } = require("../jsonlogic/validate_submission.js");
const { is_enabled, tracking_fields_for_new, diff_editable, next_periods, key_fields_of } = require("./tracking.js");
const { regenerate_field } = require("./test_data_generator.js");

/**
 * The change history a generated test record of a TRACKED form carries,
 * written exactly as the real update path (controllers/submissions/
 * update_public_record.js with tracked_records_model.apply_record_update)
 * would have written it:
 *
 *   - the record opens with its key stamp, the first value period of
 *     every updatable field and the "created" history entry
 *     (tracking_fields_for_new);
 *   - then three to six updates, each at a random moment strictly after
 *     the previous one and never after now, each changing one to three
 *     updatable fields to a fresh value drawn by the generator's own
 *     rules and re-validated like a real submission; every update closes
 *     and opens the changed fields' periods (next_periods) and appends an
 *     "updated" history entry { at, kind, by, changes } (diff_editable);
 *   - data ends as the latest values, updated_at as the last moment, and
 *     the key stamp (keys are never updatable) stays what it was.
 *
 * A form that tracks no updatable field, or no form tracking at all,
 * gets nothing more than today.
 */

const MIN_UPDATES = 3;
const MAX_UPDATES = 6;
const MAX_FIELDS_PER_UPDATE = 3;
const MIN_GAP_MS = 60 * 1000;
const MAX_GAP_MS = 3 * 24 * 3600 * 1000;
const FIRST_NAMES = ["Aline", "Eric", "Josiane", "Patrick", "Claudine", "Jean", "Diane", "Emmanuel"];
const LAST_NAMES = ["Uwase", "Mugisha", "Ingabire", "Habimana", "Mukamana", "Niyonzima", "Uwimana", "Nshimiyimana"];

function random_int(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick_random(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const out = list.slice();
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const held = out[index];
    out[index] = out[swap];
    out[swap] = held;
  }
  return out;
}

/**
 * `count` strictly increasing moments after `from` and never after
 * `until`: random gaps of a minute to three days, all scaled down together
 * when they do not fit the span (leaving part of it untouched, so the last
 * change is not glued to now). Fewer moments when the span cannot hold
 * them; none when it holds nothing.
 */
function random_update_moments(from, until, count) {
  const start = new Date(from).getTime();
  const end = new Date(until).getTime();
  const available = end - start;
  if (!(available > count) || count <= 0) return [];
  const gaps = [];
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    const gap = random_int(MIN_GAP_MS, MAX_GAP_MS);
    gaps.push(gap);
    total += gap;
  }
  const limit = Math.floor(available * (0.6 + Math.random() * 0.35));
  const scale = total > limit ? limit / total : 1;
  const moments = [];
  let at = start;
  for (const gap of gaps) {
    at += Math.max(1, Math.floor(gap * scale));
    if (at >= end) break;
    moments.push(new Date(at));
  }
  return moments;
}

/** Who made a generated update: a generated respondent, or nobody (one update in four is anonymous). */
function random_by() {
  if (Math.random() < 0.25) return null;
  const name = `${pick_random(FIRST_NAMES)} ${pick_random(LAST_NAMES)}`;
  return { name, email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`, phone: "" };
}

/**
 * One simulated update of a record: a few updatable fields get fresh
 * values, the merged answers are validated like a real submission, the
 * derived answers follow and every locked field is pinned back - exactly
 * what update_public_record does. { data, changes }, or null when no
 * valid change came up after a few tries.
 */
function simulate_update(schema, tracking, plan, editable_fields, computed_ids, data) {
  const editable_ids = new Set(editable_fields.map((field) => field.id));
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const picked = shuffle(editable_fields).slice(0, random_int(1, Math.min(MAX_FIELDS_PER_UPDATE, editable_fields.length)));
    const merged = Object.assign({}, data);
    let touched = 0;
    picked.forEach((field) => {
      const value = regenerate_field(field, merged, plan);
      if (value === undefined) return;
      merged[field.id] = value;
      touched += 1;
    });
    if (touched === 0) continue;
    const validation = validate_submission_data(schema, merged, "en");
    if (!validation.valid) continue;
    const next = Object.assign({}, validation.resolved_data);
    Object.keys(data).forEach((field_id) => {
      if (!editable_ids.has(field_id) && !computed_ids.has(field_id)) next[field_id] = data[field_id];
    });
    const changes = diff_editable(tracking, data, next);
    if (changes.length > 0) return { data: next, changes };
  }
  return null;
}

/**
 * Everything a generated record carries beyond its base document: its
 * final data and, on a tracked form, its key stamp, value periods,
 * history and updated_at. `now` bounds the update moments.
 */
function build_test_tracking(form_version, plan, data, submitted_at, now) {
  const tracking = form_version.tracking;
  if (!is_enabled(tracking)) return { data };
  const created = tracking_fields_for_new(tracking, data, submitted_at, null);
  const editable_ids = new Set(tracking.editable_field_ids || []);
  const editable_fields = plan.flat_fields.filter((field) => editable_ids.has(field.id));
  if (editable_fields.length === 0) return Object.assign({ data }, created);

  const computed_ids = new Set(plan.computed_fields.map((field) => field.id));
  const moments = random_update_moments(submitted_at, now || new Date(), random_int(MIN_UPDATES, MAX_UPDATES));
  let current = data;
  let periods = created.tracking_periods;
  const history = created.history.slice();
  let updated_at = null;
  moments.forEach((at) => {
    const update = simulate_update(form_version.schema, tracking, plan, editable_fields, computed_ids, current);
    if (!update) return;
    periods = next_periods(periods, update.changes, at, submitted_at);
    history.push({ at, kind: "updated", by: random_by(), changes: update.changes, approval_before: null });
    current = update.data;
    updated_at = at;
  });
  return Object.assign({ data: current }, created, { tracking_periods: periods, history, updated_at }, key_fields_of(tracking, current));
}

module.exports = {
  MIN_UPDATES,
  MAX_UPDATES,
  random_update_moments,
  build_test_tracking,
};
