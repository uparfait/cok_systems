const ParkingRecord = require('../../models/parking_record.js')
const {
    readVisitorInput, identifyVisitor, resolveVisitor, findOpenVisit, openVisit, attachVehicle, rollbackOpenedVisit, countVisit,
    classifyPlate, startParkingSession, normalizePlate, parkingView, emitVisitorUpdated, readBadge, assertBadgeFree,
    sendError, badRequest, conflict,
} = require('../../utilities/visitors')

/** The driver form: nested `driver`, or the flat driver_* fields older screens send. */
function driverInput(body) {
    if (body.driver && typeof body.driver === 'object') return readVisitorInput(body.driver)
    return readVisitorInput({
        full_name: body.driver_name,
        telephone: body.driver_telephone,
        email: body.driver_email,
        gender: body.driver_gender,
        identification: body.driver_identification,
    })
}

/**
 * POST /smartparking/vehicle/checkin { plate_number, visitor_id?, badge_number?, driver: { full_name, telephone, email?, gender?, identification? } }
 * The car keeps only a reference to the person who came with it. The server
 * classifies the car (staff / reserved visitor / regular). Visitors' cars
 * open their visit (or join the visit already open); staff cars only count
 * as a visit for the driver. An optional badge is kept on the car and on the
 * driver's visit.
 */
module.exports = async function car_check_in(req, res) {
    try {
        const body = req.body || {}
        const plate = normalizePlate(body.plate_number)
        if (!plate) throw badRequest('Plate number is required', { field: 'plate_number' })
        if (await ParkingRecord.exists({ plate_number: plate, status: 'active' })) {
            throw conflict(`Car with plate ${plate} is already checked in and currently active.`, { code: 'ALREADY_PARKED', field: 'plate_number' })
        }

        const input = driverInput(body)
        const badge = readBadge(body.badge_number)
        const { targetId } = await identifyVisitor({ visitorId: body.visitor_id || null, input })
        const openBefore = targetId ? await findOpenVisit(targetId) : null
        await assertBadgeFree(badge, { visitId: openBefore ? openBefore._id : null })

        const classification = await classifyPlate(plate)
        const { visitor } = await resolveVisitor({ visitorId: targetId || null, input, user: req.user, keepMissing: true })

        let visit = null
        let opened = false
        if (classification.driver_type !== 'staff') {
            visit = await findOpenVisit(visitor._id)
            if (!visit) ({ visit, opened } = await openVisit({ visitor, user: req.user, badge, vehicle: { plate_number: plate } }))
            else if (badge) visit.badge_number = badge
        }

        let record
        try {
            record = await startParkingSession({ plate, visitor, visit, user: req.user, classification, badge })
        } catch (error) {
            if (opened) await rollbackOpenedVisit(visit)
            throw error
        }

        if (visit) {
            if (opened) {
                visit.vehicle_storage.parking_record = record._id
                await visit.save()
            } else {
                // Join the open visit unless it already has another car still parked
                const linked = visit.vehicle_storage && visit.vehicle_storage.parking_record
                const otherCarParked = linked && String(linked) !== String(record._id)
                    ? await ParkingRecord.exists({ _id: linked, status: 'active' })
                    : null
                if (!otherCarParked) await attachVehicle(visit, { plate_number: plate, parking_record: record._id })
                else if (badge) await visit.save()
            }
        } else {
            await countVisit(visitor._id)
        }

        global.WebsocketIO?.emit('car_checkedin', { show_notif: false, type: 'info', message: 'New car checked in: ' + plate })
        if (opened) global.WebsocketIO?.emit('visitor_checkedin', { show_notif: false, type: 'info', message: 'A visitor checked in', visitor_id: String(visitor._id) })
        emitVisitorUpdated(visitor._id)

        const populated = await ParkingRecord.findById(record._id).populate('visitor').lean()
        return res.status(201).json({
            success: true,
            type: 'success',
            message: 'Vehicle checked in',
            visit_id: visit ? visit._id : null,
            data: parkingView(populated),
        })
    } catch (error) {
        return sendError(res, error, 'Something went wrong while checking in the car')
    }
}
