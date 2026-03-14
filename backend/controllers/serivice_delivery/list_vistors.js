const ServiceDelivery = require('../../models/service_delivery.js')

module.exports = async function list_visitors(req, res, next) {
    try {
        let { in_house = true, limit = 10, page = 1 } = req.query || {}

        const limit_val = Math.min(parseInt(limit), 50)
        const skip_val = (parseInt(page) - 1) * limit_val

        let filter = {}
        if (in_house === 'true' || in_house === true) filter.is_still_inhouse = true
        if (in_house === 'false' || in_house === false) filter.is_still_inhouse = false

        const visitors = await ServiceDelivery.find(filter)
            .limit(limit_val)
            .skip(skip_val)
            .sort({ entry_date: -1 })

        const total_count = await ServiceDelivery.countDocuments(filter)

        // Calculate current duration for in-house visitors
        const visitorsWithDuration = visitors.map(visitor => {
            const visitorObj = visitor.toObject();
            if (visitor.is_still_inhouse && visitor.entry_date) {
                const entryTime = new Date(visitor.entry_date);
                const currentTime = new Date();
                const durationMs = currentTime - entryTime;
                const hours = Math.floor(durationMs / (1000 * 60 * 60));
                const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                
                // Calculate duration in different formats
                if (hours > 0) {
                    visitorObj.current_duration = `${hours}h ${minutes}m`;
                } else {
                    visitorObj.current_duration = `${minutes} mins`;
                }
                visitorObj.current_duration_hours = hours + (minutes / 60);
                
                // Check if approaching 8 hour limit
                const hoursInside = hours + (minutes / 60);
                visitorObj.is_near_limit = hoursInside >= 7; // 7 hours = near 8 hour limit
                visitorObj.is_over_limit = hoursInside >= 8;
            } else if (visitor.vehicle_storage?.has_vehicle && visitor.vehicle_storage?.vehicle_details?.duration) {
                // Use stored duration for checked out visitors
                visitorObj.current_duration = visitor.vehicle_storage.vehicle_details.duration;
                visitorObj.current_duration_hours = parseFloat(visitor.vehicle_storage.vehicle_details.duration) / 60 || 0;
            } else {
                visitorObj.current_duration = 'N/A';
                visitorObj.current_duration_hours = 0;
            }
            return visitorObj;
        });

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Visitors results",
            total: total_count,
            page: parseInt(page),
            data: visitorsWithDuration
        })

    } catch (error) {
        console.error("Error in list_visitors:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while retrieving visitors",
            error: error.message
        })
    }
}