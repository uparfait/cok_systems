const mongoose = require('mongoose')
const ServiceDelivery = require('../../models/service_delivery.js')

module.exports = async function get_visitor_by_identification(req, res, next) {
    try {
        const { id_type, id_number } = req.query

        if (!id_type || !id_number) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: 'Both id_type and id_number are required'
            })
        }

        const trimmedIdNumber = id_number.trim()

        const visitor = await ServiceDelivery.findOne({
            'identification.id_type': id_type,
            'identification.number': trimmedIdNumber
        })

        if (!visitor) {
            return res.status(404).json({
                success: false,
                type: 'warning',
                message: 'No visitor found with this ID type and ID number'
            })
        }

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Visitor found',
            data: visitor
        })

    } catch (error) {
        console.error('Error in get_visitor_by_identification:', error)
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Something went wrong while searching for visitor',
            error: error.message
        })
    }
}