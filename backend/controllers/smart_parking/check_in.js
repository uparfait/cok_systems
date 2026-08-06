const ParkingRecord = require('../../models/parking_record.js')
const StaffCar = require('../../models/staff_car.js')
const EmergencyCar = require('../../models/emergency_car.js')
const ServiceDelivery = require('../../models/service_delivery.js')
const ParkingSlot = require('../../models/parking_slots.js')

module.exports = async function car_check_in(req, res, next) {
    try {
        let {
            plate_number = null,
            // optional fields
            driver_identification = {},
            driver_name = null,
            driver_telephone = null,
            driver_gender = null,
            driver_type = 'regular',
            driver_email = null,
            badge_number = null

        } = req.body || {}


        if(driver_type) {
            driver_type = driver_type.toString().trim().toLowerCase()
        }

        if (badge_number) {
            badge_number = badge_number.toString().trim().toUpperCase()
        }

        if (!plate_number) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "Plate number is required"
            })
        }

        // Normalize BEFORE the reservation lookups so stored plates always match
        plate_number = plate_number.toString().toUpperCase().replace(/\s+/g, '')

        // Check if this is a reserved vehicle (staff or emergency reservation).
        // Reservations never expire: they stay valid until used (vehicle checked in) or cancelled.
        const staff_car = await StaffCar.findOne({ plate_number, is_active: true });
        const emergency_reservation = await EmergencyCar.findOne({
            is_active: true,
            visitor_info: { $elemMatch: {
                plate_number,
                is_used: { $ne: true },
                is_cancelled: { $ne: true },
                // valid_until null/missing = never expires; a set date is valid through that day
                $or: [{ valid_until: null }, { valid_until: { $gte: new Date() } }]
            } }
        });

        const is_reserved = (staff_car?.is_active) || !!emergency_reservation;

        // Skip badge requirement for reserved vehicles
       // const requires_badge = !is_reserved;

        driver_type = driver_type.toLowerCase()


        const allowed_driver_type = ['regular', 'visitor', 'staff']  //  Staff Vehicle fot the Reserved Vehicle 

        if (!allowed_driver_type.includes(driver_type.toLowerCase())) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "Invalid driver type allowed types are Regular, Visitor, Staff"
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
        if ((!driver_telephone && !driver_name && staff_car) || staff_car) {
            driver_name = staff_car.owner_name
            driver_telephone = staff_car.telephone
            driver_type = "staff"
            driver_gender = staff_car.gender
            driver_email = staff_car.email
            driver_identification = {
                id_type: staff_car.id_type,
                number: staff_car.identification
            }

            slot_number = "#S"
        }

        // 2. EmergencyCar (check visitor_info array) - reuse the already fetched emergency_reservation.
        // A matched reservation ALWAYS classifies the vehicle as a reserved visitor (so the visitor
        // pool decrements), even when the gate registrar typed/edited the driver details.
        let reserved_visitor = null
        if (!staff_car && emergency_reservation) {
            const visitor = emergency_reservation.visitor_info.find(v =>
                v.plate_number === plate_number && !v.is_used && !v.is_cancelled &&
                (!v.valid_until || v.valid_until >= new Date()))
            if (visitor) {
                reserved_visitor = visitor
                driver_type = "visitor"
                driver_name = driver_name || visitor.driver_name
                driver_telephone = driver_telephone || visitor.telephone_number
                slot_number = visitor.slot_number || 'Not Specified'
                driver_email = driver_email || visitor.email || null
                driver_identification = (driver_identification && Object.keys(driver_identification).length > 0)
                    ? driver_identification
                    : (visitor.driver_identification || null)
                driver_gender = driver_gender || visitor.gender || null
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
                driver_type = "regular"
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

        // The vehicle arrived: consume its reservation so it stops counting as reserved
        if (reserved_visitor) {
            reserved_visitor.is_used = true
            reserved_visitor.used_at = check_in_date
            await emergency_reservation.save()
        }

// Update slot counts based on driver type
        // RegularAvailableSlots tracks actual vehicles inside (decrements on check-in)
        // Staff/Visitor available slots track their pool, occupied tracks actual inside
        const parkingSlotDoc = await ParkingSlot.findOne({ UnChangedId: "parking_slots" });
        if (parkingSlotDoc) {
            if (driver_type.toLowerCase() === 'visitor') {
                parkingSlotDoc.visitorsAvailableSlots = Math.max(0, (parkingSlotDoc.visitorsAvailableSlots || 0) - 1);
                parkingSlotDoc.visitorOccupiedCount = (parkingSlotDoc.visitorOccupiedCount || 0) + 1;
                // A consumed reservation no longer counts as pending
                if (reserved_visitor) {
                    parkingSlotDoc.visitorReservationCount = Math.max(0, (parkingSlotDoc.visitorReservationCount || 0) - 1);
                }
            } else if (driver_type.toLowerCase() === 'staff') {
                parkingSlotDoc.staffAvailableSlots = Math.max(0, (parkingSlotDoc.staffAvailableSlots || 0) - 1);
                parkingSlotDoc.staffOccupiedCount = (parkingSlotDoc.staffOccupiedCount || 0) + 1;
            } else if (driver_type.toLowerCase() === 'regular') {
                parkingSlotDoc.RegularAvailableSlots = Math.max(0, (parkingSlotDoc.RegularAvailableSlots || 0) - 1);
                parkingSlotDoc.regularOccupiedCount = (parkingSlotDoc.regularOccupiedCount || 0) + 1;
            }
            await parkingSlotDoc.save();
        }

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

        global.WebsocketIO?.emit('car_checkedin', {
            show_notif: false,
            type: 'info',
            message: 'New car checked in: ' + plate_number
        })

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
