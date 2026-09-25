/**
 * What the PUBLIC pages are allowed to know about a Joint event.
 *
 * A Joint event is not open the way an Internal or External one is: the
 * room is visibly occupied, but what is happening in it is not for the
 * homepage. So the live and upcoming lists carry only the room and the
 * time for it - nothing else, and the rest is not sent at all rather than
 * hidden in the browser, where anyone could read it straight out of the
 * network tab.
 *
 * Only for callers who are NOT signed in. A member of staff holding a
 * session sees the whole event as before, so the event manager's own
 * screens, which read the same endpoints, are untouched.
 *
 * Whoever is entitled to the detail asks for it by email through
 * /event-access/request-token, which is why the id is kept: it is all the
 * access overlay needs to start that.
 */

const RESTRICTED_TYPE = 'Joint';

// Everything a restricted card shows, and nothing more. eventType stays so
// the page knows to draw the restricted card; isRestricted says plainly
// that this is a trimmed record rather than an event missing its details.
function restricted_view(event) {
    return {
        _id: event._id,
        eventSpecialId: event.eventSpecialId,
        eventType: event.eventType,
        eventRoom: event.eventRoom,
        roomLocation: event.roomLocation,
        // Live events carry startedAt, upcoming ones willStartAt; both are
        // passed through so one shape serves either list.
        startedAt: event.startedAt,
        willStartAt: event.willStartAt,
        willEndAt: event.willEndAt,
        isRestricted: true,
    };
}

/** True when the request carries a signed-in session. */
function is_signed_in(req) {
    return !!(req && req.user);
}

/**
 * Whether this caller may see one event whole.
 *
 * Signed-in staff always may. So does anyone holding a verified access
 * token FOR THAT EVENT - they asked by email and the server let them in,
 * which is the whole point of the token, so the detail page must not then
 * withhold the name they were just granted. The token names one event, so
 * holding one says nothing about any other.
 */
function may_see_detail(req, event) {
    if (is_signed_in(req)) return true;
    const granted = req && req.eventAccess && req.eventAccess.eventSpecialId;
    return !!granted && !!event && granted === event.eventSpecialId;
}

/**
 * The list as the caller may see it. Anything that is not a Joint event is
 * returned untouched.
 */
function for_public(events, req) {
    if (!Array.isArray(events)) return events;
    return events.map((event) => {
        if (!event || event.eventType !== RESTRICTED_TYPE) return event;
        return may_see_detail(req, event) ? event : restricted_view(event);
    });
}

module.exports = { RESTRICTED_TYPE, restricted_view, is_signed_in, may_see_detail, for_public };
