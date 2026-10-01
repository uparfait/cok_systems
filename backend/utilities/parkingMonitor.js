const cron = require('node-cron');
const ParkingRecord = require('../models/parking_record');
const { notifyUsers, getGateRegistrarIds } = require('./notify');

// Allowed stay (milliseconds): 2 hours for regular cars, 12 hours for staff and reserved visitors
const VISITOR_LIMIT_MS = 2 * 60 * 60 * 1000;
const STAFF_LIMIT_MS = 12 * 60 * 60 * 1000;

// A regular car must leave within 30 minutes after the last service of its visit ended
const POST_SERVICE_LIMIT_MS = 30 * 60 * 1000;

const before = (now, ms) => new Date(now.getTime() - ms);

/** Active sessions, not flagged yet, that passed their allowed stay. */
function overstayedByTime(now) {
    return ParkingRecord.find({
        status: 'active',
        is_flagged: false,
        $or: [
            { driver_type: 'regular', check_in: { $lt: before(now, VISITOR_LIMIT_MS) } },
            { driver_type: { $in: ['staff', 'visitor'] }, check_in: { $lt: before(now, STAFF_LIMIT_MS) } },
        ],
    })
        .select('plate_number driver_type check_in flagged_at')
        .lean();
}

/**
 * Regular cars still within their 2 hours whose own visit (the session's
 * service_delivery link) is still open, has every service Completed or
 * Transfered, and whose last service ended more than 30 minutes ago.
 */
function overstayedAfterService(now) {
    return ParkingRecord.aggregate([
        {
            $match: {
                status: 'active',
                is_flagged: false,
                driver_type: 'regular',
                service_delivery: { $type: 'objectId' },
                check_in: { $gte: before(now, VISITOR_LIMIT_MS) },
            },
        },
        {
            $lookup: {
                from: 'servicedeliveries',
                localField: 'service_delivery',
                foreignField: '_id',
                pipeline: [
                    { $match: { is_still_inhouse: true, 'services_status.0': { $exists: true } } },
                    {
                        $project: {
                            all_done: {
                                $allElementsTrue: [{
                                    $map: {
                                        input: '$services_status',
                                        as: 'service',
                                        in: { $in: [{ $toLower: { $ifNull: ['$$service.s_type', ''] } }, ['completed', 'transfered']] },
                                    },
                                }],
                            },
                            last_ended: { $max: '$durations.services_durations.ended_at' },
                        },
                    },
                    { $match: { all_done: true, last_ended: { $lt: before(now, POST_SERVICE_LIMIT_MS) } } },
                ],
                as: 'visit',
            },
        },
        { $unwind: '$visit' },
        { $project: { plate_number: 1, driver_type: 1, check_in: 1, flagged_at: 1, last_ended: '$visit.last_ended' } },
    ]);
}

/** Flag a session that is still active and unflagged; null when it changed in the meantime. */
function flagRecord(candidate, reason, hours, now) {
    const set = {
        is_flagged: true,
        flag_reason: reason || 'Exceeded allowed parking duration',
        // Human-readable duration at flag time (the check-out replaces it)
        duration: `${hours} hours`,
    };
    // History field: survives the next check-in clearing is_flagged
    if (!candidate.flagged_at) set.flagged_at = now;
    return ParkingRecord.findOneAndUpdate(
        { _id: candidate._id, status: 'active', is_flagged: false },
        { $set: set },
        { returnDocument: 'after' },
    ).lean();
}

/** Every gate registrar: online ones get the socket message, offline ones a web push. */
function alertGates(recipients, record, reason, hours) {
    return notifyUsers({
        event: 'parking_alert',
        to: recipients,
        type: 'warning',
        title: 'Vehicle overstay alert',
        message: reason
            ? `Vehicle ${record.plate_number} ${reason}. Please follow up.`
            : `Vehicle ${record.plate_number} has stayed in the parking for ${hours} hours and passed its allowed time. Please follow up.`,
        data: {
            alert_type: 'OVERSTAY_WARNING',
            plate_number: record.plate_number,
            driver_type: record.driver_type,
            duration_hours: hours,
            record_id: String(record._id),
        },
        url: '/gate-officer/dashboard',
    });
}

/**
 * One monitor pass: flags the overstaying sessions and alerts the gates once
 * per flag. Returns what it flagged.
 * @param {Date} now  the time to check against (the cron passes the current time)
 */
async function runParkingCheck(now = new Date()) {
    const byTime = await overstayedByTime(now);
    let afterService = [];
    try {
        afterService = await overstayedAfterService(now);
    } catch (error) {
        console.error('[Monitor Error] Failed checking the visits of regular cars:', error);
    }

    const candidates = [
        ...byTime.map((record) => ({ record, reason: '' })),
        ...afterService.map((record) => ({
            record,
            reason: `remained in parking ${Math.floor((now - new Date(record.last_ended)) / 60000)} minutes after service completed`,
        })),
    ];

    const flagged = [];
    let gateRegistrarIds = null;
    for (const { record, reason } of candidates) {
        const hours = ((now - new Date(record.check_in)) / (1000 * 60 * 60)).toFixed(1);
        const updated = await flagRecord(record, reason, hours, now);
        if (!updated) continue;

        console.log(`ALERT: Vehicle ${record.plate_number} (${record.driver_type}) has overstayed.`);
        flagged.push({
            record_id: String(record._id),
            plate_number: record.plate_number,
            driver_type: record.driver_type,
            reason: updated.flag_reason,
            duration_hours: hours,
        });

        try {
            if (gateRegistrarIds === null) gateRegistrarIds = await getGateRegistrarIds();
            if (gateRegistrarIds.length > 0) await alertGates(gateRegistrarIds, record, reason, hours);
        } catch (alertError) {
            console.error('Failed to alert gate registrars:', alertError.message);
        }
    }
    return flagged;
}

let running = false;

/** Runs every minute. A pass that is still running is never overlapped. */
const startParkingMonitor = () => cron.schedule('*/1 * * * *', async () => {
    if (running) return;
    running = true;
    console.log('[Cron] Running Parking Monitor Check...');
    try {
        await runParkingCheck(new Date());
    } catch (error) {
        console.error(' Error in Parking Monitor:', error);
    } finally {
        running = false;
    }
});

startParkingMonitor.runParkingCheck = runParkingCheck;

module.exports = startParkingMonitor;
