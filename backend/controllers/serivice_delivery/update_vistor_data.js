const ServiceDelivery = require('../../models/service_delivery.js')
const {
    visitFromRef, readVisitorInput, resolveVisitor, visitView, emitVisitorUpdated, sendError, notFound, conflict,
} = require('../../utilities/visitors')

/**
 * PUT /servicedelivery/visitor/:id  (a visit id or a visitor id)
 * Updates the VISITOR behind the visit (details live in the Visitor model).
 * Only while the visitor is in house; values owned by someone else are refused.
 */
module.exports = async function update_visitor_data(req, res) {
    try {
        const visit = await visitFromRef(req.params.id, { open: false })
        if (!visit || !visit.visitor) throw notFound('Visitor not found')
        if (!visit.is_still_inhouse) throw conflict('Visitor details can only be changed while the visitor is in house')

        const input = readVisitorInput(req.body || {})
        const { changed } = await resolveVisitor({ visitorId: visit.visitor, input, user: req.user })
        if (changed) emitVisitorUpdated(visit.visitor)

        const fresh = await ServiceDelivery.findById(visit._id).populate('visitor').lean()
        return res.status(200).json({
            success: true,
            type: 'success',
            message: changed ? 'Visitor details updated' : 'Nothing changed',
            data: visitView(fresh),
        })
    } catch (error) {
        return sendError(res, error, 'Failed to update the visitor')
    }
}
