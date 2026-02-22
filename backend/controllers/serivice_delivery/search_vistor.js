const ServiceDelivery = require('../../models/service_delivery.js')

module.exports = async function search_visitors(req, res, next) {
    try {
        let { query = '', in_house = true, limit = 10, page = 1 } = req.query || {}

        const limit_val = Math.min(parseInt(limit), 50)
        const skip_val = (parseInt(page) - 1) * limit_val

        const safe_query = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(safe_query, 'i')

        let search_criteria = {
            $or: [
                { full_name: regex },
                { telephone: regex },
                { 'identification.number': regex },
                { plate_number: regex }
            ]
        }

        // If specifically requested true/false, add it to criteria
        if (in_house === 'true' || in_house === true) search_criteria.is_still_inhouse = true
        if (in_house === 'false' || in_house === false) search_criteria.is_still_inhouse = false

        const visitors = await ServiceDelivery.find(search_criteria)
            .limit(limit_val)
            .skip(skip_val)
            .sort({ entry_date: -1 })

        const total_count = await ServiceDelivery.countDocuments(search_criteria)

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Visitor search results",
            total: total_count,
            page: parseInt(page),
            data: visitors
        })

    } catch (error) {
        console.error("Error in search_visitors:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while searching visitors",
            error: error.message
        })
    }
}