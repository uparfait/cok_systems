const ServiceDelivery = require('../../models/service_delivery.js')
const ParkingRecord = require('../../models/parking_record.js')
const {
    visitFromRef, closeVisit, activeParkingForVisit, visitView, emitVisitorUpdated, visitorNameOf, alreadyCheckedOut,
    sendError, badRequest, notFound, conflict,
} = require('../../utilities/visitors')

const alreadyOutside = (name) => conflict(`${name || 'This visitor'} is already marked as outside.`, { code: 'ALREADY_OUTSIDE' })

/**
 * POST /servicedelivery/visitor/partial-exit { visitor_id }  (a visit id or a visitor id)
 * The visitor walks out to their car: the visit stays open and is marked as
 * out until the car leaves. Without a parked car this is a full checkout.
 * The badge is taken back: cleared on the visit and on the parked car.
 * Nothing is done twice: a visitor already outside or already gone is refused.
 */
module.exports = async function partial_exit(req, res) {
    try {
        const ref = (req.body && (req.body.visit_id || req.body.visitor_id)) || null
        if (!ref) throw badRequest('Visitor ID is required')
        const visit = await visitFromRef(ref, { open: false })
        if (!visit) throw notFound('Visitor not found')
        const name = await visitorNameOf(visit)
        if (!visit.is_still_inhouse) throw alreadyCheckedOut(visit, name)
        if (visit.marked_as_out) throw alreadyOutside(name)

        const car = await activeParkingForVisit(visit)
        if (!car) {
            const closed = await closeVisit(visit, { visitorName: name })
            if (!closed) throw alreadyCheckedOut(await ServiceDelivery.findById(visit._id).select('exist_date').lean(), name)
            global.WebsocketIO?.emit('visitor_checkedout', { show_notif: false, type: 'info', message: 'A visitor checked out', visitor_id: String(visit.visitor || '') })
            emitVisitorUpdated(visit.visitor)
            const gone = await ServiceDelivery.findById(visit._id).populate('visitor').lean()
            return res.status(200).json({
                success: true,
                type: 'success',
                message: 'No parked car was found for this visitor, so the visitor was checked out',
                checked_out: true,
                data: visitView(gone),
            })
        }

        const set = { marked_as_out: true, badge_number: null }
        if (!visit.vehicle_storage || !visit.vehicle_storage.parking_record) set['vehicle_storage.parking_record'] = car._id
        const marked = await ServiceDelivery.updateOne({ _id: visit._id, is_still_inhouse: true, marked_as_out: { $ne: true } }, { $set: set })
        if (!marked.modifiedCount) throw alreadyOutside(name)
        await ParkingRecord.updateOne({ _id: car._id }, { $set: { badge_number: null } })
        emitVisitorUpdated(visit.visitor)

        const fresh = await ServiceDelivery.findById(visit._id).populate('visitor').lean()
        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Visitor marked as outside',
            checked_out: false,
            plate_number: car.plate_number,
            data: visitView(fresh),
        })
    } catch (error) {
        return sendError(res, error, 'Failed to process partial exit')
    }
}
