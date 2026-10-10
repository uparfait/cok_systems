const mongoose = require('mongoose')
const ParkingRecord = require('../../models/parking_record.js')
const { parkingView, sendError, badRequest, notFound } = require('../../utilities/visitors')
const { withLiveDuration } = require('./parking_lists.js')

/**
 * GET /smartparking/vehicle/:id
 * One parking session with the person who came with the car (flat driver_*
 * fields from the visitor) and the time parked so far.
 */
module.exports = async function get_parking_record_by_id(req, res) {
    try {
        const { id } = req.params
        if (!mongoose.Types.ObjectId.isValid(id)) throw badRequest('Invalid Parking Record ID format')

        const record = await ParkingRecord.findById(id).populate('visitor').lean()
        if (!record) throw notFound('Parking record not found')

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Parking record details',
            data: withLiveDuration(parkingView(record)),
        })
    } catch (error) {
        return sendError(res, error, 'Something went wrong while retrieving parking record details')
    }
}
