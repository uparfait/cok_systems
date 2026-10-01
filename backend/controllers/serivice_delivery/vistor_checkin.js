const ServiceDelivery = require('../../models/service_delivery.js')
const ParkingRecord = require('../../models/parking_record.js')
const {
    readVisitorInput, identifyVisitor, resolveVisitor, findOpenVisit, openVisit, rollbackOpenedVisit, classifyPlate, startParkingSession,
    normalizePlate, visitView, emitVisitorUpdated, sendError, badRequest, conflict,
} = require('../../utilities/visitors')

const truthy = (value) => value === true || value === 'true' || value === 1 || value === '1'

/**
 * POST /servicedelivery/visitor/checkin
 * Body: { visitor_id?, full_name, telephone, email?, gender, identification: { id_type, number },
 *         has_vehicle?, plate_number?, items_entered_with? }
 * Registers (or updates) the visitor, opens the visit and - when the visitor
 * came by car - starts the parking session linked to that visit.
 */
module.exports = async function visitor_checkin(req, res) {
    try {
        const body = req.body || {}
        const typedPlate = body.plate_number || (body.vehicle_storage && body.vehicle_storage.vehicle_details && body.vehicle_storage.vehicle_details.plate_number)
        const hasVehicle = truthy(body.has_vehicle) || !!typedPlate
        const plate = hasVehicle ? normalizePlate(typedPlate) : ''
        if (hasVehicle && plate.length < 3) {
            throw badRequest('Enter a valid plate number', { field: 'plate_number' })
        }
        if (hasVehicle && await ParkingRecord.exists({ plate_number: plate, status: 'active' })) {
            throw conflict(`Car with plate ${plate} is already checked in and currently active.`, { code: 'ALREADY_PARKED', field: 'plate_number' })
        }

        const input = readVisitorInput(body)
        // Refuse a visitor already in house before changing anything about them
        const { targetId } = await identifyVisitor({ visitorId: body.visitor_id || null, input })
        if (targetId && await findOpenVisit(targetId)) {
            throw conflict(`${input.full_name} is already in house`, { code: 'ALREADY_IN_HOUSE', visitor_id: targetId })
        }
        const { visitor, created } = await resolveVisitor({ visitorId: targetId || null, input, user: req.user })

        const items = Array.isArray(body.items_entered_with) ? body.items_entered_with : []
        const { visit, opened } = await openVisit({ visitor, user: req.user, items, vehicle: hasVehicle ? { plate_number: plate } : null })

        if (hasVehicle) {
            try {
                const classification = await classifyPlate(plate)
                const record = await startParkingSession({ plate, visitor, visit, user: req.user, classification })
                visit.vehicle_storage.parking_record = record._id
                await visit.save()
            } catch (error) {
                if (opened) await rollbackOpenedVisit(visit)
                throw error
            }
            global.WebsocketIO?.emit('car_checkedin', { show_notif: false, type: 'info', message: 'New car checked in: ' + plate })
        }

        global.WebsocketIO?.emit('visitor_checkedin', { show_notif: false, type: 'info', message: 'A visitor checked in', visitor_id: String(visitor._id) })
        emitVisitorUpdated(visitor._id)

        const populated = await ServiceDelivery.findById(visit._id).populate('visitor').lean()
        return res.status(201).json({
            success: true,
            type: 'success',
            message: created ? 'Visitor registered and checked in' : 'Visitor checked in',
            visitor_created: created,
            data: visitView(populated),
        })
    } catch (error) {
        return sendError(res, error, 'Failed to check in the visitor')
    }
}
