const ParkingRecord = require('../../models/parking_record.js')
const { parkingView, sendError } = require('../../utilities/visitors')
const { queryText, pageParams, recordSearchFilter, withLiveDuration } = require('./parking_lists.js')

const validDate = (date) => !Number.isNaN(date.getTime())

/** check_in range: one whole day (?date=YYYY-MM-DD) or ?from / ?to (YYYY-MM-DD). Invalid dates are ignored. */
function checkInRange(date, from, to) {
    if (date) {
        const startOfDay = new Date(date)
        const endOfDay = new Date(date)
        if (!validDate(startOfDay)) return null
        startOfDay.setHours(0, 0, 0, 0)
        endOfDay.setHours(23, 59, 59, 999)
        return { $gte: startOfDay, $lte: endOfDay }
    }
    const range = {}
    if (from) {
        const start = new Date(from)
        start.setHours(0, 0, 0, 0)
        if (validDate(start)) range.$gte = start
    }
    if (to) {
        const end = new Date(to)
        end.setHours(23, 59, 59, 999)
        if (validDate(end)) range.$lte = end
    }
    return Object.keys(range).length ? range : null
}

/**
 * GET /smartparking/vehicle ?status=active (default) | completed | all &page &limit (<= 1000)
 *     &date | &from &to &search
 * Parking sessions, newest first. Each row is the session with the person who
 * came with the car (flat driver_* fields from the visitor) and the time
 * parked so far. search matches the plate, or the driver's name, telephone,
 * ID number or email through the visitors.
 */
module.exports = async function list_parking_records(req, res) {
    try {
        const q = req.query || {}
        // The dashboard parking map loads every parked car in one request, hence the 1000 cap
        const { page, limit, skip } = pageParams(q, { limit: 10, max: 1000 })
        const status = q.status === undefined ? 'active' : queryText(q.status)

        const filter = {}
        if (status === 'active' || status === 'completed') filter.status = status
        const checkIn = checkInRange(queryText(q.date), queryText(q.from), queryText(q.to))
        if (checkIn) filter.check_in = checkIn
        const search = await recordSearchFilter(q.search)
        if (search) Object.assign(filter, search)

        const [records, total] = await Promise.all([
            ParkingRecord.find(filter).sort({ check_in: -1, _id: -1 }).skip(skip).limit(limit).populate('visitor').lean(),
            ParkingRecord.countDocuments(filter),
        ])

        const now = new Date()
        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Parking records',
            total,
            page,
            limit,
            data: records.map((record) => withLiveDuration(parkingView(record), now)),
        })
    } catch (error) {
        return sendError(res, error, 'Something went wrong while retrieving parking records')
    }
}
