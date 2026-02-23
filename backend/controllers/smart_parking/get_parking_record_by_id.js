const mongoose = require('mongoose')
const ParkingRecord = require('../../models/parking_record.js')

module.exports = async function get_parking_record_by_id(req, res, next) {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Invalid Parking Record ID format"
            })
        }

        const record = await ParkingRecord.findById(id)

        if (!record) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: "Parking record not found"
            })
        }

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Parking record details",
            data: record
        })

    } catch (error) {
        console.error("Error in get_parking_record_by_id:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while retrieving parking record details",
            error: error.message
        })
    }
}