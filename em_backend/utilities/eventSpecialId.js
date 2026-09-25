/**
 * An event keeps one identity across its whole life, but not one string.
 *
 * While an event is live its eventSpecialId is the plain id it was created
 * with. When it ends, EventService.moveLiveToPast stores the past event
 * under `<id>__<timestamp>` (services/EventService.js), so the same event
 * is addressed by a LONGER id afterwards - which is what the details and
 * calendar pages then ask for.
 *
 * Anything written against the event while it was live - attendance above
 * all, which can only be submitted to a LIVE event - still carries the
 * short id. So a lookup by the exact string finds nothing the moment the
 * event ends, and the attendance list goes empty even though every record
 * is still there.
 *
 * These two helpers keep the two spellings of one identity together.
 */

const SUFFIX = '__';

/** The id an event had while it was live, whichever spelling comes in. */
function base_event_special_id(event_special_id) {
    const text = String(event_special_id == null ? '' : event_special_id);
    const cut = text.indexOf(SUFFIX);
    return cut === -1 ? text : text.slice(0, cut);
}

/**
 * A Mongo condition matching the event under either spelling - a plain
 * equality while it is live, and both ids once it has ended, so records
 * written before it ended are still found.
 */
function event_special_id_match(event_special_id) {
    const full = String(event_special_id == null ? '' : event_special_id);
    const base = base_event_special_id(full);
    return full === base ? full : { $in: [full, base] };
}

module.exports = { base_event_special_id, event_special_id_match };
