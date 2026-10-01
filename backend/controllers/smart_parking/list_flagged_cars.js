const ParkingRecord = require('../../models/parking_record.js')
const { parkingView, sendError } = require('../../utilities/visitors')
const { queryText, pageParams, withLiveDuration } = require('./parking_lists.js')

/**
 * GET /smartparking/vehicle/flagged ?status=active (default, still parked) | completed | all &page &limit (<= 50)
 * Sessions carrying the live flag (set by the parking monitor, cleared by the
 * next check-in of the plate), the same set the flagged statistics count.
 * Each row has the person who came with the car (driver_name,
 * driver_telephone, driver_identification... from the visitor).
 */
module.exports = async function list_flagged_cars(req, res) {
    try {
        const q = req.query || {}
        const { page, limit, skip } = pageParams(q, { limit: 10, max: 50 })
        const status = q.status === undefined ? 'active' : queryText(q.status)

        const filter = { is_flagged: true }
        if (status === 'active' || status === 'completed') filter.status = status

        const [records, total] = await Promise.all([
            ParkingRecord.find(filter).sort({ check_in: -1, _id: -1 }).skip(skip).limit(limit).populate('visitor').lean(),
            ParkingRecord.countDocuments(filter),
        ])

        const now = new Date()
        return res.status(200).json({
            success: true,
            type: 'success',
            message: filter.status ? `${filter.status} flagged vehicle records` : 'All flagged vehicle records',
            total,
            page,
            limit,
            data: records.map((record) => withLiveDuration(parkingView(record), now)),
        })
    } catch (error) {
        return sendError(res, error, 'Something went wrong while retrieving flagged vehicles')
    }
}
