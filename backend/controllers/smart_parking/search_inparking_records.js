const ParkingRecord = require('../../models/parking_record.js')
const { parkingView, sendError } = require('../../utilities/visitors')
const { queryText, pageParams, recordSearchFilter, withLiveDuration } = require('./parking_lists.js')

/**
 * GET /smartparking/vehicle/search ?query &status=active (default) | completed | all &page &limit (<= 50)
 * Parking sessions whose plate matches the query (spaces and dashes ignored),
 * or whose driver's name, telephone, ID number or email matches it (searched
 * in the visitors). Same rows as the parking list.
 */
module.exports = async function search_parking_records(req, res) {
    try {
        const q = req.query || {}
        const { page, limit, skip } = pageParams(q, { limit: 10, max: 50 })
        const status = q.status === undefined ? 'active' : queryText(q.status)

        const filter = {}
        if (status === 'active' || status === 'completed') filter.status = status
        const search = await recordSearchFilter(q.query)
        if (search) Object.assign(filter, search)

        const [records, total] = await Promise.all([
            ParkingRecord.find(filter).sort({ check_in: -1, _id: -1 }).skip(skip).limit(limit).populate('visitor').lean(),
            ParkingRecord.countDocuments(filter),
        ])

        const now = new Date()
        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Search results',
            total,
            page,
            limit,
            data: records.map((record) => withLiveDuration(parkingView(record), now)),
        })
    } catch (error) {
        return sendError(res, error, 'Something went wrong while searching parking records')
    }
}
