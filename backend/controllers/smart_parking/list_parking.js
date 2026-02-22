const ParkingRecord = require('../../models/parking_record.js')

module.exports = async function list_parking_records(req, res, next) {
    try {
        let { status = 'active', limit = 10, page = 1 } = req.query || {}

        const limit_val = Math.min(parseInt(limit), 50)
        const skip_val = (parseInt(page) - 1) * limit_val

        let filter = {}
        if (status === 'active' || status === 'completed') {
            filter.status = status
        }

        const records = await ParkingRecord.find(filter)
            .limit(limit_val)
            .skip(skip_val)
            .sort({ check_in: -1 })

        const total_count = await ParkingRecord.countDocuments(filter)

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Parking records",
            total: total_count,
            page: parseInt(page),
            data: records
        })

    } catch (error) {
        console.error("Error in list_parking_records:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while retrieving parking records",
            error: error.message
        })
    }
}