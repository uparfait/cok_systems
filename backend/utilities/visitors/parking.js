/**
 * Parking sessions. The server decides the driver type from the staff
 * registry and the visitor reservations (the client value is never trusted),
 * keeps the ParkingSlot counters with atomic updates, and links each session
 * to the person who came with the car.
 */

const ParkingRecord = require('../../models/parking_record.js');
const ParkingSlot = require('../../models/parking_slots.js');
const StaffCar = require('../../models/staff_car.js');
const EmergencyCar = require('../../models/emergency_car.js');
const FlaggedVehicle = require('../../models/flagged_vehicle.js');
const { conflict, isDuplicateKey } = require('./errors.js');
const { minutesBetween, userName } = require('./visits.js');

const SLOT_DOC = { UnChangedId: 'parking_slots' };

// [available pool, occupied count, capacity] per driver type
const POOLS = {
    visitor: ['visitorsAvailableSlots', 'visitorOccupiedCount', 'visitorsReservedSlots'],
    staff: ['staffAvailableSlots', 'staffOccupiedCount', 'staffReservedSlots'],
    regular: ['RegularAvailableSlots', 'regularOccupiedCount', 'RegularReservedSlots'],
};

// Allowed stay checked at check-out (minutes)
const ALLOWED_MINUTES = { staff: 720, visitor: 120, regular: 120 };

const inWindow = (now) => ([
    { $or: [{ valid_from: null }, { valid_from: { $lte: now } }] },
    { $or: [{ valid_until: null }, { valid_until: { $gte: now } }] },
]);

/** Staff car, reserved visitor or regular - decided only by the registries. */
async function classifyPlate(plate) {
    const now = new Date();
    const staffCar = await StaffCar.findOne({ plate_number: plate, is_active: true, $and: inWindow(now) }).lean();
    if (staffCar) {
        return { driver_type: 'staff', slot_number: '#S', staff_car: staffCar, reservation: null, reservation_doc_id: null };
    }
    const reservationDoc = await EmergencyCar.findOne({
        is_active: true,
        visitor_info: { $elemMatch: { plate_number: plate, is_used: { $ne: true }, is_cancelled: { $ne: true }, $and: inWindow(now) } },
    }).lean();
    const reservation = reservationDoc
        ? (reservationDoc.visitor_info || []).find((v) => v.plate_number === plate && !v.is_used && !v.is_cancelled
            && (!v.valid_from || new Date(v.valid_from) <= now) && (!v.valid_until || new Date(v.valid_until) >= now))
        : null;
    if (reservation) {
        return {
            driver_type: 'visitor',
            slot_number: reservation.slot_number || 'Not Specified',
            staff_car: null,
            reservation,
            reservation_doc_id: reservationDoc._id,
        };
    }
    return { driver_type: 'regular', slot_number: 'Not Specified', staff_car: null, reservation: null, reservation_doc_id: null };
}

/** Occupied +1 and available -1 (never below 0). */
async function occupySlot(driverType) {
    const pool = POOLS[driverType];
    if (!pool) return;
    const [available, occupied] = pool;
    const taken = await ParkingSlot.updateOne({ ...SLOT_DOC, [available]: { $gt: 0 } }, { $inc: { [available]: -1, [occupied]: 1 } });
    if (!taken.modifiedCount) await ParkingSlot.updateOne(SLOT_DOC, { $inc: { [occupied]: 1 } });
}

/** Occupied -1 (never below 0) and available +1 (never above capacity). */
async function releaseSlot(driverType) {
    const pool = POOLS[driverType];
    if (!pool) return;
    const [available, occupied, capacity] = pool;
    await ParkingSlot.updateOne({ ...SLOT_DOC, [occupied]: { $gt: 0 } }, { $inc: { [occupied]: -1 } });
    await ParkingSlot.updateOne({ ...SLOT_DOC, $expr: { $lt: [`$${available}`, `$${capacity}`] } }, { $inc: { [available]: 1 } });
}

/** Mark a reservation used once, and count it out of the pending ones. */
async function consumeReservation(classification, now) {
    if (!classification.reservation || !classification.reservation_doc_id) return;
    const used = await EmergencyCar.updateOne(
        { _id: classification.reservation_doc_id, visitor_info: { $elemMatch: { _id: classification.reservation._id, is_used: { $ne: true } } } },
        { $set: { 'visitor_info.$.is_used': true, 'visitor_info.$.used_at': now } },
    );
    if (used.modifiedCount) {
        await ParkingSlot.updateOne({ ...SLOT_DOC, visitorReservationCount: { $gt: 0 } }, { $inc: { visitorReservationCount: -1 } });
    }
}

function activeRecordForPlate(plate) {
    return ParkingRecord.findOne({ plate_number: plate, status: 'active' }).sort({ check_in: -1 });
}

/** The car of a visit that is still parked: by the stored link, else by the visit or its plate. */
async function activeParkingForVisit(visit) {
    if (!visit) return null;
    const storage = visit.vehicle_storage || {};
    if (storage.parking_record) {
        const linked = await ParkingRecord.findOne({ _id: storage.parking_record, status: 'active' });
        if (linked) return linked;
    }
    const byVisit = await ParkingRecord.findOne({ service_delivery: visit._id, status: 'active' });
    if (byVisit) return byVisit;
    const plate = storage.has_vehicle && storage.vehicle_details && storage.vehicle_details.plate_number;
    return plate ? activeRecordForPlate(String(plate).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()) : null;
}

/**
 * Start a session. Refuses (409) when the plate is already parked.
 * @returns {Promise<ParkingRecord>}
 */
async function startParkingSession({ plate, visitor, visit = null, user, classification, badge = null }) {
    const alreadyParked = await ParkingRecord.exists({ plate_number: plate, status: 'active' });
    if (alreadyParked) throw conflict(`Car with plate ${plate} is already checked in and currently active.`, { code: 'ALREADY_PARKED' });

    const now = new Date();
    let record;
    try {
        record = await ParkingRecord.create({
            plate_number: plate,
            visitor: visitor._id || visitor,
            service_delivery: visit ? visit._id : null,
            driver_type: classification.driver_type,
            slot_number: classification.slot_number,
            status: 'active',
            check_in: now,
            checked_in_by: userName(user),
            badge_number: badge || null,
        });
    } catch (error) {
        if (isDuplicateKey(error)) throw conflict(`Car with plate ${plate} is already checked in and currently active.`, { code: 'ALREADY_PARKED' });
        throw error;
    }
    await consumeReservation(classification, now);
    await occupySlot(classification.driver_type);
    // A new arrival clears the live flag of earlier sessions (flag history stays in flagged_at)
    await ParkingRecord.updateMany({ plate_number: plate, is_flagged: true, _id: { $ne: record._id } }, { $set: { is_flagged: false } });
    return record;
}

/**
 * End the active session of a plate. Atomic: two gates checking the same car
 * out at once cannot both succeed.
 * @returns {Promise<{ record, minutes, violation }>}
 */
async function endParkingSession(record, user) {
    const now = new Date();
    const minutes = minutesBetween(record.check_in, now);
    const closed = await ParkingRecord.findOneAndUpdate(
        { _id: record._id, status: 'active' },
        { $set: { status: 'completed', check_out: now, duration: `${minutes} mins` } },
        { returnDocument: 'after' },
    );
    if (!closed) throw conflict('This car has already been checked out.', { code: 'ALREADY_CHECKED_OUT' });
    await releaseSlot(closed.driver_type);

    let violation = null;
    const allowed = ALLOWED_MINUTES[closed.driver_type] || ALLOWED_MINUTES.regular;
    if (minutes > allowed) {
        const flaggedAt = new Date(new Date(closed.check_in).getTime() + allowed * 60000);
        await FlaggedVehicle.create({
            plate_number: closed.plate_number,
            driver_type: closed.driver_type || 'regular',
            visitor: closed.visitor || null,
            parking_record: closed._id,
            slot_number: closed.slot_number,
            checked_in_by: closed.checked_in_by,
            check_in_time: closed.check_in,
            flagged_at: flaggedAt,
            check_out_time: now,
            allowed_duration_minutes: allowed,
            total_duration_minutes: minutes,
            flagged_duration_minutes: minutes - allowed,
        });
        if (!closed.flagged_at) {
            closed.flagged_at = flaggedAt;
            closed.flag_reason = `Exceeded allowed ${allowed} minutes by ${minutes - allowed} minutes`;
            await closed.save();
        }
        violation = { allowed_minutes: allowed, total_minutes: minutes, overstayed_minutes: minutes - allowed };
    }
    return { record: closed, minutes, violation, checkedOutBy: userName(user) };
}

/** The person who came with this car the last time it parked. */
async function lastDriverForPlate(plate) {
    const last = await ParkingRecord.findOne({ plate_number: plate, visitor: { $ne: null } })
        .sort({ check_in: -1 })
        .populate('visitor')
        .lean();
    return last && last.visitor ? last.visitor : null;
}

module.exports = {
    POOLS,
    ALLOWED_MINUTES,
    classifyPlate,
    occupySlot,
    releaseSlot,
    activeRecordForPlate,
    activeParkingForVisit,
    startParkingSession,
    endParkingSession,
    lastDriverForPlate,
};
