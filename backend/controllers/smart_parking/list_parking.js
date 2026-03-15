const ParkingRecord = require('../../models/parking_record.js')

module.exports = async function list_parking_records(req, res, next) {
    try {
        let { status = 'active', limit = 10, page = 1, date = null } = req.query || {}

        const limit_val = Math.min(parseInt(limit), 50)
        const skip_val = (parseInt(page) - 1) * limit_val

        let filter = {}
        if (status === 'active' || status === 'completed') {
            filter.status = status
        }

        // Filter by date if provided (format: YYYY-MM-DD)
        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            
            filter.check_in = {
                $gte: startOfDay,
                $lte: endOfDay
            };
        }

        const records = await ParkingRecord.find(filter)
            .limit(limit_val)
            .skip(skip_val)
            .sort({ check_in: -1 })

        const total_count = await ParkingRecord.countDocuments(filter)

        // Calculate current duration for active records
        const recordsWithDuration = records.map(record => {
            const recordObj = record.toObject();
            if (record.status === 'active') {
                const checkInTime = new Date(record.check_in);
                const currentTime = new Date();
                const durationMs = currentTime - checkInTime;
                const hours = Math.floor(durationMs / (1000 * 60 * 60));
                const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                
                // Calculate duration in different formats
                if (hours > 0) {
                    recordObj.current_duration = `${hours}h ${minutes}m`;
                } else {
                    recordObj.current_duration = `${minutes} mins`;
                }
                recordObj.current_duration_hours = hours + (minutes / 60);
                
                // Check if approaching 8 hour limit (for visitors)
                const hoursParked = hours + (minutes / 60);
                recordObj.is_near_limit = hoursParked >= 7; // 7 hours = near 8 hour limit
                recordObj.is_over_limit = hoursParked >= 8;
            } else {
                // For completed records, use the stored duration
                recordObj.current_duration = record.duration;
                recordObj.current_duration_hours = parseFloat(record.duration) / 60 || 0;
            }
            return recordObj;
        });

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Parking records",
            total: total_count,
            page: parseInt(page),
            data: recordsWithDuration
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