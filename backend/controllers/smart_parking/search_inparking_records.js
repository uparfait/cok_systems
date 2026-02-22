const ParkingRecord = require('../../models/parking_record.js')

module.exports = async function search_parking_records(req, res, next) {
    try {
        let { query = '', limit = 10, page = 1 } = req.query || {}

        const limit_val = Math.min(parseInt(limit), 50)
        const skip_val = (parseInt(page) - 1) * limit_val

        // Escape special characters to prevent Regex DDoS/NoSQL injection
        const safe_query = query?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(safe_query || '', 'i') // 'i' makes it case-insensitive

        const search_criteria = {
            $or: [
                { plate_number: query?.toString().toUpperCase().replace(/\s+/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') },
                { driver_name: regex },
                { 'driver_identification.number': regex }
            ]
        }

        const records = await ParkingRecord.find(search_criteria)
            .limit(limit_val)
            .skip(skip_val)
            .sort({ check_in: -1 })

        const total_count = await ParkingRecord.countDocuments(search_criteria)

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Search results",
            total: total_count,
            page: parseInt(page),
            data: records
        })

    } catch (error) {
        console.error("Error in search_parking_records:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while searching parking records",
            error: error.message
        })
    }
}