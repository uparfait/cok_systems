const ServiceDelivery = require('../../models/service_delivery.js')
const ParkingRecord = require('../../models/parking_record.js')
const {
    visitFromRef, closeVisit, activeParkingForVisit, visitView, emitVisitorUpdated, sendError, badRequest, notFound,
} = require('../../utilities/visitors')

/**
 * POST /servicedelivery/visitor/partial-exit { visitor_id }  (a visit id or a visitor id)
 * The visitor walks out to their car: the visit stays open and is marked as
 * out until the car leaves. Without a parked car this is a full checkout.
 * The badge is taken back: cleared on the visit and on the parked car.
 */
module.exports = async function partial_exit(req, res) {
    try {
        const ref = (req.body && (req.body.visit_id || req.body.visitor_id)) || null
        if (!ref) throw badRequest('Visitor ID is required')
        const visit = await visitFromRef(ref)
        if (!visit || !visit.is_still_inhouse) throw notFound('Visitor not found or already checked out')

        const car = await activeParkingForVisit(visit)
        if (!car) {
            const named = await ServiceDelivery.findById(visit._id).populate('visitor', 'full_name').lean()
            await closeVisit(visit, { visitorName: named && named.visitor ? named.visitor.full_name : '' })
            global.WebsocketIO?.emit('visitor_checkedout', { show_notif: false, type: 'info', message: 'A visitor checked out', visitor_id: String(visit.visitor || '') })
            emitVisitorUpdated(visit.visitor)
            const closed = await ServiceDelivery.findById(visit._id).populate('visitor').lean()
            return res.status(200).json({
                success: true,
                type: 'success',
                message: 'No parked car was found for this visitor, so the visitor was checked out',
                checked_out: true,
                data: visitView(closed),
            })
        }

        visit.marked_as_out = true
        visit.badge_number = null
        if (!visit.vehicle_storage.parking_record) visit.vehicle_storage.parking_record = car._id
        await visit.save()
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
