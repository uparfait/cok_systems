const ServiceDelivery = require('../../models/service_delivery.js')
const ParkingRecord = require('../../models/parking_record.js')

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

        // Identification is no longer strictly required
        if (!full_name || !telephone) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "Full name and telephone required for visitor registration"
            })
        }

        // check if vistor is already in 

        const is_already_registered = await ServiceDelivery.findOne({
            full_name: full_name,
            telephone: telephone,
            is_still_inhouse: true
        })

        if(is_already_registered) {
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
            
            // Look for the car
            const active_parking = await ParkingRecord.findOne({ plate_number: plate, status: 'active' })
            
            if (active_parking) {
                console.log('has vehicle')
                // 1. Fill out the missing parking record fields with the visitor's data
                if(!active_parking.driver_name) active_parking.driver_name = full_name
                if(!active_parking.driver_telephone) active_parking.driver_telephone = telephone || 'Not specified'
                if(!active_parking.driver_type) active_parking.driver_type = 'Regular'
                if(!active_parking.driver_email) active_parking.driver_email = email || 'Not specified'
                if(!active_parking.driver_gender) active_parking.driver_gender = gender
                
                // If the gate guard missed the ID but reception got it, update it here
                if (identification && identification.id_type && (!active_parking.driver_identification || !active_parking.driver_identification.number)) {
                    active_parking.driver_identification = identification
                }
                
                await active_parking.save()

                // 2. Sync the visitor's 'entered_time' with the exact time the gate opened
                vehicle_storage.vehicle_details.entered_time = active_parking.check_in
            } else if(!active_parking){
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
                    driver_type: 'Regular',
                    check_in: new Date(),
                    status: 'active',
                    checked_in_by: req.user?.name || "Not specified"
                })

               const save = await new_parking.save()


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

        const websocketUtils = require('../../../utilities/websocket_utils.js');
        if (websocketUtils && global.WebsocketIO) {
            websocketUtils.emitToSystem(global.WebsocketIO, 'service_delivery', 'visitor_checkedin', { 
                show_notif: false,
                type: 'info',
                message: 'Visitor checked in: ' + full_name
             });
        }

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