/**
 * Visitor badges, as the gate has always used them: optional, written in
 * upper case, one badge per person inside. A partial exit takes the badge
 * back (visit and car); the return may hand one out again.
 */

const ServiceDelivery = require('../../models/service_delivery.js');
const ParkingRecord = require('../../models/parking_record.js');
const { badRequest } = require('./errors.js');
const { clean } = require('./normalize.js');

/** The badge from a form, or null when none was given. */
function readBadge(value) {
    const text = clean(value);
    if (!text) return null;
    const badge = text.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z0-9-]+$/.test(badge)) throw badRequest('Invalid badge number format', { code: 'BADGE_INVALID', field: 'badge_number' });
    return badge;
}

/**
 * Refuse a badge held by someone else inside: an open visit or a parked car,
 * other than the visit / car given.
 */
async function assertBadgeFree(badge, { visitId = null, recordId = null } = {}) {
    if (!badge) return;
    const visitFilter = { badge_number: badge, is_still_inhouse: true };
    if (visitId) visitFilter._id = { $ne: visitId };
    const carFilter = { badge_number: badge, status: 'active' };
    if (recordId) carFilter._id = { $ne: recordId };
    const [visit, car] = await Promise.all([ServiceDelivery.exists(visitFilter), ParkingRecord.exists(carFilter)]);
    if (visit || car) {
        throw badRequest('Someone with this badge number is already checked in.', { code: 'BADGE_IN_USE', field: 'badge_number' });
    }
}

module.exports = {
    readBadge,
    assertBadgeFree,
};
