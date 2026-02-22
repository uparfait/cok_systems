const mongoose = require('mongoose')
const ServiceDelivery = require('../../models/ServiceDelivery.js')

module.exports = async function get_visitor_by_id(req, res, next) {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                type: "warning",
                message: "Invalid Visitor ID format"
            })
        }

        const visitor = await ServiceDelivery.findById(id)

        if (!visitor) {
            return res.status(404).json({
                success: false,
                type: "warning",
                message: "Visitor not found"
            })
        }

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Visitor details",
            data: visitor
        })

    } catch (error) {
        console.error("Error in get_visitor_by_id:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while retrieving visitor details",
            error: error.message
        })
    }
}