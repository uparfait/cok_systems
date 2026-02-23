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

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Visitors results",
            total: total_count,
            page: parseInt(page),
            data: visitors
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