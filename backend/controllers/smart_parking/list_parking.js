const ParkingRecord = require('../../models/parking_record.js')

module.exports = async function list_parking_records(req, res, next) {
    try {
        let { status = 'active', limit = 10, page = 1, date = null, from = null, to = null, search = null } = req.query || {}

        // Cap raised from 50 so the dashboard parking map can load every currently-parked vehicle in one request
        const limit_val = Math.min(parseInt(limit), 1000)
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
        } else if (from || to) {
            // Date range filter (format: YYYY-MM-DD)
            filter.check_in = {}
            if (from) {
                const start = new Date(from)
                start.setHours(0, 0, 0, 0)
                if (!isNaN(start.getTime())) filter.check_in.$gte = start
            }
            if (to) {
                const end = new Date(to)
                end.setHours(23, 59, 59, 999)
                if (!isNaN(end.getTime())) filter.check_in.$lte = end
            }
            if (Object.keys(filter.check_in).length === 0) delete filter.check_in
        }

        // Free-text search across plate, driver, phone and badge
        if (search && String(search).trim()) {
            const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const re = new RegExp(escaped, 'i')
            filter.$or = [
                { plate_number: re },
                { driver_name: re },
                { driver_telephone: re },
                { badge_number: re },
            ]
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