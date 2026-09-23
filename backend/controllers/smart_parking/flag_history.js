const ParkingRecord = require('../../models/parking_record.js')

// Allowed stay used to estimate flagged_at for records flagged before the history field existed
const LIMIT_MINUTES = { regular: 120, staff: 720, visitor: 720 }

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Every parking session that was ever flagged, whether or not the plate has since checked in again
module.exports = async function flag_history(req, res, next) {
    try {
        let { limit = 20, page = 1, query = '' } = req.query || {}

        const limit_val = Math.min(Math.max(parseInt(limit) || 20, 1), 100)
        const page_val = Math.max(parseInt(page) || 1, 1)
        const skip_val = (page_val - 1) * limit_val

        // is_flagged covers legacy records flagged before flagged_at was recorded
        const filter = { $or: [{ flagged_at: { $ne: null } }, { is_flagged: true }] }

        query = query.toString().trim()
        if (query) {
            const rx = new RegExp(escapeRegex(query.replace(/\s+/g, '')), 'i')
            const name_rx = new RegExp(escapeRegex(query), 'i')
            filter.$and = [{ $or: [{ plate_number: rx }, { driver_name: name_rx }, { driver_telephone: name_rx }] }]
        }

        const [records, total_count] = await Promise.all([
            ParkingRecord.find(filter).sort({ flagged_at: -1, check_in: -1 }).skip(skip_val).limit(limit_val).lean(),
            ParkingRecord.countDocuments(filter)
        ])

        const now = new Date()
        const data = records.map(r => {
            const check_in = r.check_in ? new Date(r.check_in) : null
            const check_out = r.check_out ? new Date(r.check_out) : null
            const allowed = LIMIT_MINUTES[r.driver_type] || LIMIT_MINUTES.regular

            const flagged_at_estimated = !r.flagged_at
            const flagged_at = r.flagged_at
                ? new Date(r.flagged_at)
                : (check_in ? new Date(check_in.getTime() + allowed * 60000) : null)

            // Duration runs until check-out, or until now for vehicles still inside
            const end = check_out || now
            const total_duration_minutes = check_in ? Math.max(0, Math.round((end - check_in) / 60000)) : null
            const overstay_minutes = flagged_at ? Math.max(0, Math.round((end - flagged_at) / 60000)) : null

            return {
                _id: r._id,
                plate_number: r.plate_number,
                driver_name: r.driver_name,
                driver_telephone: r.driver_telephone,
                driver_type: r.driver_type,
                slot_number: r.slot_number,
                checked_in_by: r.checked_in_by,
                status: r.status,
                check_in,
                check_out,
                flagged_at,
                flagged_at_estimated,
                flag_reason: r.flag_reason || 'Exceeded allowed parking duration',
                is_flagged: !!r.is_flagged,
                allowed_duration_minutes: allowed,
                total_duration_minutes,
                overstay_minutes
            }
        })

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Flag history retrieved',
            total: total_count,
            page: page_val,
            limit: limit_val,
            data
        })
    } catch (error) {
        console.error('Error in flag_history:', error)
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while retrieving flag history',
            error: error.message
        })
    }
}
