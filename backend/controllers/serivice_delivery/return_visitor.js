const ServiceDelivery = require('../../models/service_delivery.js')
const ParkingRecord = require('../../models/parking_record.js')
const {
    visitFromRef, activeParkingForVisit, readBadge, assertBadgeFree, visitView, emitVisitorUpdated, sendError, badRequest, notFound,
} = require('../../utilities/visitors')

/**
 * POST /servicedelivery/visitor/return (alias /visitor/return-with-badge) { visitor_id, badge_number? }
 * A visitor marked as out came back inside. The optional badge is given to
 * the visit and to the car that is still parked.
 */
module.exports = async function return_visitor(req, res) {
    try {
        const ref = (req.body && (req.body.visit_id || req.body.visitor_id)) || null
        if (!ref) throw badRequest('Visitor ID is required')
        const visit = await visitFromRef(ref)
        if (!visit || !visit.is_still_inhouse) throw notFound('Visitor not found or already checked out')

        const badge = readBadge(req.body.badge_number)
        const car = await activeParkingForVisit(visit)
        await assertBadgeFree(badge, { visitId: visit._id, recordId: car ? car._id : null })

        visit.marked_as_out = false
        visit.badge_number = badge
        await visit.save()
        if (car) await ParkingRecord.updateOne({ _id: car._id }, { $set: { badge_number: badge } })
        emitVisitorUpdated(visit.visitor)

        const fresh = await ServiceDelivery.findById(visit._id).populate('visitor').lean()
        return res.status(200).json({ success: true, type: 'success', message: badge ? `Visitor returned with badge ${badge}` : 'Visitor marked as returned', data: visitView(fresh) })
    } catch (error) {
        return sendError(res, error, 'Failed to mark the visitor as returned')
    }
}
