/**
 * Old-structure records (before visitors were split out): visits and parking
 * sessions that carry personal details instead of a visitor reference, and
 * the rows derived from them. The System Admin reviews and deletes them.
 */

const ServiceDelivery = require('../../models/service_delivery.js');
const ParkingRecord = require('../../models/parking_record.js');
const FlaggedVehicle = require('../../models/flagged_vehicle.js');
const ServiceTracking = require('../../models/service_tracking.js');
const ParkingSlot = require('../../models/parking_slots.js');
const Visitor = require('../../models/visitor.js');

const NO_VISITOR = { $or: [{ visitor: { $exists: false } }, { visitor: null }] };

const COLLECTIONS = [
    {
        key: 'service_deliveries',
        label: 'Service delivery visits without a visitor reference',
        model: ServiceDelivery,
        filter: NO_VISITOR,
        sample: { full_name: 1, telephone: 1, entry_date: 1, is_still_inhouse: 1 },
        sort: { entry_date: -1 },
    },
    {
        key: 'parking_records',
        label: 'Parking records without a visitor reference',
        model: ParkingRecord,
        filter: NO_VISITOR,
        sample: { plate_number: 1, driver_name: 1, check_in: 1, status: 1 },
        sort: { check_in: -1 },
    },
    {
        key: 'flagged_vehicles',
        label: 'Flagged vehicle receipts without a visitor reference',
        model: FlaggedVehicle,
        filter: NO_VISITOR,
        sample: { plate_number: 1, driver_name: 1, check_in_time: 1, flagged_at: 1 },
        sort: { check_in_time: -1 },
    },
    {
        key: 'service_trackings',
        label: 'Service tracking rows without a visit reference',
        model: ServiceTracking,
        filter: { $or: [{ service_delivery: { $exists: false } }, { service_delivery: null }] },
        sample: { department_name: 1, provider_name: 1, started_at: 1, duration: 1 },
        sort: { started_at: -1 },
    },
];

async function scanCollection(spec) {
    const [count, sample] = await Promise.all([
        spec.model.countDocuments(spec.filter),
        spec.model.find(spec.filter).select(spec.sample).sort(spec.sort).limit(5).lean(),
    ]);
    return { key: spec.key, label: spec.label, count, sample };
}

/** GET /legacy-data/scan */
async function scan_legacy_data(req, res) {
    try {
        const data = await Promise.all(COLLECTIONS.map(scanCollection));
        const total = data.reduce((sum, row) => sum + row.count, 0);
        return res.status(200).json({ success: true, type: 'success', data, total });
    } catch (error) {
        console.error('Legacy data scan failed:', error);
        return res.status(500).json({ success: false, type: 'error', message: 'Failed to scan for old records', error: error.message });
    }
}

/** Occupied counts from the active sessions, available pools from capacity. */
async function recalculateParkingCounters() {
    const counts = await ParkingRecord.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$driver_type', n: { $sum: 1 } } },
    ]);
    const of = (type) => (counts.find((c) => c._id === type) || { n: 0 }).n;
    const visitor = of('visitor');
    const staff = of('staff');
    const regular = of('regular');
    await ParkingSlot.updateOne({ UnChangedId: 'parking_slots' }, [
        {
            $set: {
                visitorOccupiedCount: visitor,
                staffOccupiedCount: staff,
                regularOccupiedCount: regular,
                visitorsAvailableSlots: { $max: [0, { $subtract: [{ $ifNull: ['$visitorsReservedSlots', 0] }, visitor] }] },
                staffAvailableSlots: { $max: [0, { $subtract: [{ $ifNull: ['$staffReservedSlots', 0] }, staff] }] },
                RegularAvailableSlots: { $max: [0, { $subtract: [{ $ifNull: ['$RegularReservedSlots', 0] }, regular] }] },
            },
        },
    ], { updatePipeline: true });
    return { visitor, staff, regular };
}

/** Is_In_House for everyone, from the open visits. */
async function recalculatePresence() {
    const openIds = await ServiceDelivery.distinct('visitor', { is_still_inhouse: true, visitor: { $ne: null } });
    await Visitor.updateMany({ _id: { $nin: openIds } }, { $set: { Is_In_House: false } });
    await Visitor.updateMany({ _id: { $in: openIds } }, { $set: { Is_In_House: true } });
    return openIds.length;
}

/** POST /legacy-data/delete { collections: [keys], confirm: 'DELETE' } */
async function delete_legacy_data(req, res) {
    try {
        const { collections = [], confirm = '' } = req.body || {};
        if (String(confirm).trim() !== 'DELETE') {
            return res.status(400).json({ success: false, type: 'warning', message: 'Type DELETE to confirm' });
        }
        const keys = Array.isArray(collections) ? collections : [collections];
        const chosen = COLLECTIONS.filter((spec) => keys.includes(spec.key));
        if (chosen.length === 0) {
            return res.status(400).json({ success: false, type: 'warning', message: 'Choose at least one kind of record to delete' });
        }
        const deleted = {};
        for (const spec of chosen) {
            const result = await spec.model.deleteMany(spec.filter);
            deleted[spec.key] = result.deletedCount || 0;
        }
        const occupied = await recalculateParkingCounters();
        const inHouse = await recalculatePresence();
        console.log(`[LEGACY DATA] ${req.user && req.user.email} deleted`, deleted);
        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Old records deleted. Parking counters and in-house flags were recalculated.',
            data: { deleted, occupied, in_house_visitors: inHouse },
        });
    } catch (error) {
        console.error('Legacy data delete failed:', error);
        return res.status(500).json({ success: false, type: 'error', message: 'Failed to delete old records', error: error.message });
    }
}

module.exports = {
    COLLECTIONS,
    scan_legacy_data,
    delete_legacy_data,
    recalculateParkingCounters,
    recalculatePresence,
};
