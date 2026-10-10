const ServiceDelivery = require('../../models/service_delivery.js')
const { visitFromRef, visitView, sendError, notFound } = require('../../utilities/visitors')

/**
 * GET /servicedelivery/visitor/:id  (a visit id, or a visitor id for their latest visit)
 */
module.exports = async function get_visitor_by_id(req, res) {
    try {
        const visit = await visitFromRef(req.params.id, { open: false })
        if (!visit) throw notFound('Visitor not found')
        const populated = await ServiceDelivery.findById(visit._id).populate('visitor').lean()
        return res.status(200).json({ success: true, type: 'success', message: 'Visitor found', data: visitView(populated) })
    } catch (error) {
        return sendError(res, error, 'Failed to load the visitor')
    }
}
