const ServiceDelivery = require('../../models/service_delivery.js')
const {
    visitFromRef, closeVisit, activeParkingForVisit, visitView, emitVisitorUpdated, visitorNameOf, alreadyCheckedOut,
    sendError, badRequest, notFound, conflict,
} = require('../../utilities/visitors')

/**
 * POST /servicedelivery/visitor/checkout { visitor_id }  (a visit id or a visitor id)
 * Closes the visit of a visitor leaving on foot. A visitor whose car is still
 * parked leaves through the vehicle exit instead (the car checkout closes the visit).
 * A visitor who already left is refused (409 ALREADY_CHECKED_OUT), never closed twice.
 */
module.exports = async function visitor_checkout(req, res) {
    try {
        const ref = (req.body && (req.body.visit_id || req.body.visitor_id)) || null
        if (!ref) throw badRequest('Visitor ID is required')
        const visit = await visitFromRef(ref, { open: false })
        if (!visit) throw notFound('Visitor not found')
        const name = await visitorNameOf(visit)
        if (!visit.is_still_inhouse) throw alreadyCheckedOut(visit, name)

        const car = await activeParkingForVisit(visit)
        if (car) {
            throw conflict(`This visitor came with car ${car.plate_number}, which is still parked. Check the car out at the vehicle exit.`, { code: 'CAR_STILL_PARKED', plate_number: car.plate_number })
        }

        const closed = await closeVisit(visit, { visitorName: name })
        if (!closed) throw alreadyCheckedOut(await ServiceDelivery.findById(visit._id).select('exist_date').lean(), name)

        global.WebsocketIO?.emit('visitor_checkedout', { show_notif: false, type: 'info', message: 'A visitor checked out', visitor_id: String(visit.visitor || '') })
        emitVisitorUpdated(visit.visitor)

        const fresh = await ServiceDelivery.findById(visit._id).populate('visitor').lean()
        return res.status(200).json({ success: true, type: 'success', message: 'Visitor checked out', data: visitView(fresh) })
    } catch (error) {
        return sendError(res, error, 'Failed to check out the visitor')
    }
}
