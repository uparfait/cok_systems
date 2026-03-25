const ParkingRecord = require('../../models/parking_record.js')
const StaffCar = require('../../models/staff_car.js')
const EmergencyCar = require('../../models/emergency_car.js')
const ServiceDelivery = require('../../models/service_delivery.js')

module.exports = async function car_check_in(req, res, next) {
    try {
        let {
            plate_number = null,
            // optional fields
            driver_identification = {},
            driver_name = null,
            driver_telephone = null,
            driver_gender = null,
            driver_type = 'Regular',
            driver_email = null,
            badge_number = null

        } = req.body || {}

        if (!plate_number) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "Plate number is required"
            })
        }

        // Check if this is a reserved vehicle (staff or emergency reservation)
        const staff_car = await StaffCar.findOne({ plate_number, is_active: true });
        const emergency_reservation = await EmergencyCar.findOne({
            "visitor_info.plate_number": plate_number,
            "validity.to": { $gte: new Date() },
            is_active: true
        });
        
        const is_reserved = (staff_car?.is_active) || !!emergency_reservation;

        // Skip badge requirement for reserved vehicles
        const requires_badge = !is_reserved;

        driver_type = driver_type.toLowerCase()
        

        const allowed_driver_type = ['regular', 'visitor', 'staff', 'Staff Vehicle']  //  Staff Vehicle fot the Reserved Vehicle 

        if(!allowed_driver_type.includes(driver_type.toLowerCase())) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "Invalid driver type allowed types are Regular, Visitor, Staff"
            })
        }

        // Normalize plate number
        plate_number = plate_number.toString().toUpperCase().replace(/\s+/g, '')

        // Prevent duplicate active sessions
        const existing_active_car = await ParkingRecord.findOne({ plate_number, status: 'active' })
        if (existing_active_car) {
            return res.status(409).json({
                success: false,
                type: 'warning',
                message: `Car with plate ${plate_number} is already checked in and currently active.`
            })
        }

        let checked_in_by = req.user?.name || "Not specified"

        let slot_number = null

        // 1. StaffCar - reuse the already fetched staff_car
        if((!driver_telephone && !driver_name && staff_car) || staff_car) {
            driver_name = staff_car.owner_name
            driver_telephone = staff_car.telephone
            driver_type = "Staff"
            driver_gender = staff_car.gender
            driver_email = staff_car.email
            driver_identification = {
                id_type: staff_car.id_type,
                number: staff_car.identification
            }

            slot_number =   "#S"
        }

        // 2. EmergencyCar (check visitor_info array) - reuse the already fetched emergency_reservation
        if (!driver_name && emergency_reservation) {
            const visitor = emergency_reservation.visitor_info.find(v => v.plate_number === plate_number)
            if (visitor) {
                driver_name = visitor.driver_name
                driver_type =  "Visitor"
                driver_telephone = visitor.telephone_number
                slot_number = visitor.slot_number || 'Not Specified'
                driver_email = visitor.email || null
                driver_identification = visitor.driver_identification || null
                driver_gender = visitor.gender || null
            }
        }

        // 3. ServiceDelivery (if visitor already registered with vehicle)
        if (!driver_name) {
            const service_delivery = await ServiceDelivery.findOne({
                "vehicle_storage.has_vehicle": true,
                "vehicle_storage.vehicle_details.plate_number": plate_number
            })
            if (service_delivery) {
                driver_name = service_delivery.full_name
                driver_type = "Regular"
                driver_telephone = service_delivery.telephone
                driver_gender = service_delivery.gender || null
                driver_email = service_delivery.email || null
                driver_identification = service_delivery.identification || null
                slot_number = 'Not Specified'
            }
        }

        const check_in_date = new Date()

        // --- Create ParkingRecord ---
        const new_parking = new ParkingRecord({
            plate_number,
            driver_identification,
            driver_name,
            driver_telephone,
            driver_gender,
            driver_type,
            driver_email,
            slot_number,
            status: 'active',
            check_in: check_in_date,
            checked_in_by,
            badge_number
        })

        await new_parking.save()

        // search this car in all parking records and mark it as not flagged if it was flagged before

        await ParkingRecord.updateMany({ plate_number, is_flagged: true }, { is_flagged: false })

        // Create ServiceDelivery record for all checked-in visitors (with or without vehicle)
        // This allows Service Delivery receptionist to see and assign them to departments
        
        if (driver_name && (driver_type.toLowerCase() === 'regular' || driver_type.toLowerCase() === 'visitor' || driver_type.toLowerCase() === 'staff')) {
            const hasVehicle = plate_number && plate_number !== 'N/A' && plate_number.toUpperCase() !== 'NOT SPECIFIED';
            const service_delivery = new ServiceDelivery({
                full_name: driver_name,
                telephone: driver_telephone,
                gender: driver_gender,
                email: driver_email,
                driver_identification: driver_identification,
                identification: driver_identification, // Also save to identification field for compatibility
                vehicle_storage: {
                    has_vehicle: hasVehicle,
                    vehicle_details: hasVehicle ? {
                        plate_number,
                        slot_number
                    } : null
                },
                badge_number,
                is_still_inhouse: true,
                entry_date: check_in_date,
                registered_by: checked_in_by
            })
            await service_delivery.save()
        }

        const websocketUtils = require('../../../utilities/websocket_utils.js');
        websocketUtils.emitToSystems(global.WebsocketIO, ['smart_parking', 'service_delivery'], 'car_checkedin', { 
            show_notif: false,
            type: 'info',
            message: 'New car checked in: ' + plate_number
         });

        return res.status(201).json({
            success: true,
            type: "success",
            message: "Data saved successfully",
            data: {
                plate_number,
                driver_name,
                driver_telephone,
                driver_gender,
                driver_type,
                driver_email,
                slot_number,
                status: 'active',
                check_in: check_in_date,
                checked_in_by,
                badge_number
            }
        })

    } catch (error) {
        console.error("Error in car_check_in:", error)
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while checking in the car",
            error: error.message
        })
    }
}
