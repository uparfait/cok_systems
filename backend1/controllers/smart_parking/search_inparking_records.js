const ParkingRecord = require('../../models/parking_record.js')

module.exports = async function search_parking_records(req, res, next) {
    try {
        let { query = '', limit = 10, page = 1, status = 'active' } = req.query || {}

        const limit_val = Math.min(parseInt(limit), 50)
        const skip_val = (parseInt(page) - 1) * limit_val

        // Escape special characters to prevent Regex DDoS/NoSQL injection
        const safe_query = query?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(safe_query || '', 'i') // 'i' makes it case-insensitive

        const plate_regex = new RegExp(safe_query?.replace(/\s+/g, '') || '', 'i');

        // use and to search with appropriate status
        const search_criteria = {

            $and: [
                {
                    $or: [
                        { plate_number: plate_regex },
                        { driver_name: regex },
                        { 'driver_identification.number': regex },
                        { driver_telephone: regex },
                        { driver_email: regex },
                        { badge_number: regex }
                    ]
                },
                { status: status }
            ]
        }

        const records = await ParkingRecord.find(search_criteria)
            .limit(limit_val)
            .skip(skip_val)
            .sort({ check_in: -1 })

        const total_count = await ParkingRecord.countDocuments(search_criteria)

        // Calculate current duration for active records
        const recordsWithDuration = records.map(record => {
            const recordObj = record.toObject();
            if (record.status === 'active') {
                const checkInTime = new Date(record.check_in);
                const currentTime = new Date();
                const durationMs = currentTime - checkInTime;
                const hours = Math.floor(durationMs / (1000 * 60 * 60));
                const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                
                if (hours > 0) {
                    recordObj.current_duration = `${hours}h ${minutes}m`;
                } else {
                    recordObj.current_duration = `${minutes} mins`;
                }
                recordObj.current_duration_hours = hours + (minutes / 60);
                
                const hoursParked = hours + (minutes / 60);
                recordObj.is_near_limit = hoursParked >= 7;
                recordObj.is_over_limit = hoursParked >= 8;
            } else {
                recordObj.current_duration = record.duration;
                recordObj.current_duration_hours = parseFloat(record.duration) / 60 || 0;
            }
            return recordObj;
        });

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Search results",
            total: total_count,
            page: parseInt(page),
            data: recordsWithDuration
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