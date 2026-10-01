const ServiceDelivery = require('../../models/service_delivery.js')
const { visitFromRef, visitView, emitVisitorUpdated, sendError, badRequest, notFound } = require('../../utilities/visitors')

/**
 * POST /servicedelivery/visitor/return (alias /visitor/return-with-badge) { visitor_id }
 * A visitor marked as out came back inside. Badges are no longer used.
 */
module.exports = async function return_visitor(req, res) {
    try {
        const ref = (req.body && (req.body.visit_id || req.body.visitor_id)) || null
        if (!ref) throw badRequest('Visitor ID is required')
        const visit = await visitFromRef(ref)
        if (!visit || !visit.is_still_inhouse) throw notFound('Visitor not found or already checked out')

        visit.marked_as_out = false
        await visit.save()
        emitVisitorUpdated(visit.visitor)

        const fresh = await ServiceDelivery.findById(visit._id).populate('visitor').lean()
        return res.status(200).json({ success: true, type: 'success', message: 'Visitor marked as returned', data: visitView(fresh) })
    } catch (error) {
        return sendError(res, error, 'Failed to mark the visitor as returned')
    }
}
