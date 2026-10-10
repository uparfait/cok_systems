const ParkingRecord = require('../../models/parking_record.js')
const { parkingView, sendError } = require('../../utilities/visitors')
const { pageParams, recordSearchFilter } = require('./parking_lists.js')

// Allowed stay used to estimate flagged_at for records flagged before the history field existed
const LIMIT_MINUTES = { regular: 120, staff: 720, visitor: 720 }

const minutesBetween = (from, to) => Math.max(0, Math.round((to - from) / 60000))

function historyRow(record, now) {
    const check_in = record.check_in ? new Date(record.check_in) : null
    const check_out = record.check_out ? new Date(record.check_out) : null
    const allowed = LIMIT_MINUTES[record.driver_type] || LIMIT_MINUTES.regular

    const flagged_at_estimated = !record.flagged_at
    const flagged_at = record.flagged_at
        ? new Date(record.flagged_at)
        : (check_in ? new Date(check_in.getTime() + allowed * 60000) : null)

    // Duration runs until check-out, or until now for vehicles still inside
    const end = check_out || now
    return {
        ...parkingView(record),
        check_in,
        check_out,
        flagged_at,
        flagged_at_estimated,
        flag_reason: record.flag_reason || 'Exceeded allowed parking duration',
        is_flagged: !!record.is_flagged,
        allowed_duration_minutes: allowed,
        total_duration_minutes: check_in ? minutesBetween(check_in, end) : null,
        overstay_minutes: flagged_at ? minutesBetween(flagged_at, end) : null,
    }
}

/**
 * GET /smartparking/vehicle/flag-history ?page &limit (<= 100) &query
 * Every parking session that was ever flagged (flagged_at set, or the live
 * is_flagged of records older than that field), whether or not the plate has
 * checked in again. query matches the plate, or the driver's name,
 * telephone, ID number or email through the visitors.
 */
module.exports = async function flag_history(req, res) {
    try {
        const q = req.query || {}
        const { page, limit, skip } = pageParams(q, { limit: 20, max: 100 })

        const filter = { $or: [{ flagged_at: { $ne: null } }, { is_flagged: true }] }
        const search = await recordSearchFilter(q.query)
        if (search) filter.$and = [search]

        const [records, total] = await Promise.all([
            ParkingRecord.find(filter).sort({ flagged_at: -1, check_in: -1, _id: -1 }).skip(skip).limit(limit).populate('visitor').lean(),
            ParkingRecord.countDocuments(filter),
        ])

        const now = new Date()
        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Flag history retrieved',
            total,
            page,
            limit,
            data: records.map((record) => historyRow(record, now)),
        })
    } catch (error) {
        return sendError(res, error, 'Something went wrong while retrieving flag history')
    }
}
