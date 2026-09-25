/**
 * How a widget BEHAVES under the board's own controls - the two things a
 * report-style board needs that a plain chart does not:
 *
 * - its TIME WINDOW, and whether it is LOCKED to it. An unlocked widget
 *   follows the board's date filter, as every widget always has; a locked
 *   one reads the window it was given whatever the board shows, and the
 *   card says so with a "Fixed" chip.
 * - the board filters it is PINNED against. A widget pinned on the
 *   district field keeps its district breakdown while the board is
 *   filtered to one district (and the filters under that field - its
 *   sectors - are ignored with it), so a row of district cards stays a row
 *   of district cards.
 *
 * Pure helpers shared by the composers, the card and the settings dialog.
 */

export const PERIOD_PRESETS = ["all", "today", "this_week", "this_month", "last_month", "this_year", "custom"];

export const PRESET_KEYS = {
  all: "DCS_STATS_PERIOD_ALL",
  today: "DCS_STATS_PERIOD_TODAY",
  this_week: "DCS_STATS_PERIOD_THIS_WEEK",
  this_month: "DCS_STATS_PERIOD_THIS_MONTH",
  last_month: "DCS_STATS_PERIOD_LAST_MONTH",
  this_year: "DCS_STATS_PERIOD_THIS_YEAR",
  custom: "DCS_STATS_PERIOD_CUSTOM",
};

/** The window a widget starts with: everything, following the board. */
export const default_period = () => ({ preset: "all", from: null, to: null, locked: false });

/** A widget's period, completed: { preset, from, to, locked }. */
export function period_of(widget) {
  const raw = (widget && widget.period) || null;
  if (!raw || !PERIOD_PRESETS.includes(raw.preset)) return default_period();
  return { preset: raw.preset, from: raw.from || null, to: raw.to || null, locked: raw.locked === true };
}

export const is_period_locked = (widget) => period_of(widget).locked;

/** The board filter fields a widget refuses to follow. */
export const pinned_of = (widget) => (Array.isArray(widget && widget.pinned_fields) ? widget.pinned_fields.filter(Boolean) : []);

/** The period as the widget document stores it: `locked` only when true. */
export function period_document(period) {
  const held = period || default_period();
  const out = { preset: PERIOD_PRESETS.includes(held.preset) ? held.preset : "all", from: held.preset === "custom" ? held.from || null : null, to: held.preset === "custom" ? held.to || null : null };
  if (held.locked === true) out.locked = true;
  return out;
}

/** Why a period cannot be saved yet: a custom window with no start. */
export function period_problem(period, translate) {
  const held = period || default_period();
  if (held.preset === "custom" && !held.from) return translate("DCS_DB_PERIOD_NEED_FROM");
  return "";
}

const day_text = (value) => {
  if (!value) return "";
  const date = new Date(/T\d{2}:\d{2}/.test(String(value)) ? value : `${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

/** The window in words: "This year", or "1 Jan 2026 - 31 Aug 2026". */
export function period_label(period, translate) {
  const held = period || default_period();
  if (held.preset !== "custom") return translate(PRESET_KEYS[held.preset] || PRESET_KEYS.all);
  return `${day_text(held.from)} - ${held.to ? day_text(held.to) : translate("DCS_DB_PERIOD_NOW")}`;
}

/**
 * The drafts a composer built, with the behaviour the composer's spec
 * asked for written onto each: the period (locked or not) and the pinned
 * fields. A spec without a period leaves the draft's own alone.
 */
export function with_behavior(widgets, spec) {
  return (widgets || []).map((widget) => {
    const next = Object.assign({}, widget, { pinned_fields: Array.isArray(spec.pinned_fields) ? spec.pinned_fields.slice(0, 10) : [] });
    if (spec.period) next.period = period_document(spec.period);
    return next;
  });
}

/** The behaviour keys a saved widget hands back to the composer that reopens it. */
export const behavior_spec = (widget) => ({ period: period_of(widget), pinned_fields: pinned_of(widget) });
