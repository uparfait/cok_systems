const ServiceDelivery = require('../../models/service_delivery.js')
const ParkingRecord = require('../../models/parking_record.js')

const isValidEmail = (email) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
const isValidPhone = (phone) => !phone || /^\+?[0-9\s\-()]{7,15}$/.test(phone)
const isValidPlate = (plate) => !plate || /^[A-Za-z0-9\s\-]{3,10}$/.test(plate)
const isValidBadge = (badge) => !badge || /^[A-Za-z0-9\-]+$/.test(badge)


module.exports = async function visitor_checkin(req, res, next) {
    try {
        let {
            full_name = null,
            telephone = null,
            email = null,
            identification = {}, // Optional
            gender = 'Not specified',
            vehicle_storage = {},
            items_entered_with = [],
            badge_number = null
        } = req.body || {}

        if (badge_number) {
            badge_number = badge_number.toString().trim().toUpperCase()
        }

        // Identification is no longer strictly required
        if (!full_name || !telephone) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "Full name and telephone required for visitor registration"
            })
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "Invalid email format"
            })
        }

        if (!isValidPhone(telephone)) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "Invalid telephone format"
            })
        }

        if (!isValidBadge(badge_number)) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "Invalid badge number format"
            })
        }

        if (vehicle_storage.has_vehicle && !isValidPlate(vehicle_storage.vehicle_details?.plate_number)) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "Invalid vehicle plate number format"
            })
        }

        // check in service delivery and in parking if no one with that badge number currently in house

        if (badge_number) {
            
            const existing_badge_in_service_delivery = await ServiceDelivery.findOne({ badge_number, is_still_inhouse: true })
            const existing_badge_in_parking = await ParkingRecord.findOne({ badge_number, status: 'active' })
            if (existing_badge_in_service_delivery || existing_badge_in_parking) {
                return res.status(400).json({
                    success: false,
                    type: 'warning',
                    message: "Someone with this badge number is already checked in."
                })
            }
        }

        // check if vistor is already in 

        const is_already_registered = await ServiceDelivery.findOne({
            full_name: full_name,
            telephone: telephone,
            is_still_inhouse: true
        })

        if (is_already_registered) {
            return res.status(409).json({
                success: false,
                type: 'warning',
                message: "Visitor with the same name and telephone is already checked in and currently inhouse."
            })
        }

        // --- CAR  ---
        if (vehicle_storage.has_vehicle && vehicle_storage.vehicle_details?.plate_number) {

            // Clean plate number
            let plate = vehicle_storage.vehicle_details.plate_number.toString().toUpperCase().replace(/\s+/g, '')
            vehicle_storage.vehicle_details.plate_number = plate
            const cleanPlateNumber = (plate) => plate?.replace(/\s/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || '';
            plate = cleanPlateNumber(plate);

            // Look for the car
            const active_parking = await ParkingRecord.findOne({ plate_number: plate, status: 'active' })

            if (active_parking) {
                console.log('has vehicle')
                // 1. Fill out the missing parking record fields with the visitor's data
                if (!active_parking.driver_name) active_parking.driver_name = full_name
                if (!active_parking.driver_telephone) active_parking.driver_telephone = telephone || 'Not specified'
                // Must be lowercase: the ParkingRecord enum only accepts 'staff' | 'visitor' | 'regular'
                if (!active_parking.driver_type) active_parking.driver_type = 'regular'
                if (!active_parking.driver_email) active_parking.driver_email = email || 'Not specified'
                if (!active_parking.driver_gender) active_parking.driver_gender = gender

                // If the gate guard missed the ID but reception got it, update it here
                if (identification && identification.id_type && (!active_parking.driver_identification || !active_parking.driver_identification.number)) {
                    active_parking.driver_identification = identification
                }

                await active_parking.save()

                // 2. Sync the visitor's 'entered_time' with the exact time the gate opened
                vehicle_storage.vehicle_details.entered_time = active_parking.check_in
            } else if (!active_parking) {
                console.log('we are going to checkin a vehicle')

                // save vehicle to parking record

                const new_parking = new ParkingRecord({
                    plate_number: plate,
                    driver_name: full_name,
                    driver_identification: identification || null,
                    slot_number: 'Not specified',
                    driver_telephone: telephone || 'Not specified',
                    driver_email: email || 'Not specified',
                    driver_gender: gender,
                    // Must be lowercase: the ParkingRecord enum only accepts 'staff' | 'visitor' | 'regular'
                    driver_type: 'regular',
                    check_in: new Date(),
                    status: 'active',
                    checked_in_by: req.user?.name || "Not specified"
                })

                const save = await new_parking.save()

                // A vehicle entered through the reception flow — notify dashboards the same way the gate does
                global.WebsocketIO?.emit('car_checkedin', {
                    show_notif: false,
                    type: 'info',
                    message: 'New car checked in: ' + plate
                })


                vehicle_storage.vehicle_details.entered_time = new_parking.check_in

            }
        } else {
            console.log('not has a vehicle')

            vehicle_storage = { has_vehicle: false }
        }

        let registered_by = req.user?.name || "Not specified"

        const new_visitor = new ServiceDelivery({
            full_name,
            telephone,
            email,
            identification,
            driver_identification: identification,
            gender,
            vehicle_storage,
            items_entered_with,
            departments_assigned: [],
            services_status: [],
            is_still_inhouse: true,
            entry_date: new Date(),
            registered_by,
            badge_number
        })

        const saved_visitor = await new_visitor.save()

        global.WebsocketIO?.emit('visitor_checkedin', {
            show_notif: false,
            type: 'info',
            message: 'Visitor checked in: ' + full_name
        })

        return res.status(201).json({
            success: true,
            type: "success",
            message: "Visitor checked in successfully",
            data: saved_visitor
        })

    } catch (error) {
        console.error("Error in visitor_checkin:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while checking in visitor",
            error: error.message
        })
    }
}