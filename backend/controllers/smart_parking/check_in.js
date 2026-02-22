const ParkingRecord = require('../../models/parking_record.js');
const StaffCar = require('../../models/staff_car.js');
const EmergencyCar = require('../../models/emergency_car.js');
const ServiceDelivery = require('../../models/service_delivery.js');

module.exports = async function car_check_in(req, res, next) {
    try {
        let {
            plate_number = null,
            driver_identification = {} // optional
        } = req.body || {};

        if (!plate_number) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "Plate number is required"
            });
        }

        // Normalize plate number
        plate_number = plate_number.toString().toUpperCase().replace(/\s+/g, '');

        // Prevent duplicate active sessions
        const existing_active_car = await ParkingRecord.findOne({ plate_number, status: 'active' });
        if (existing_active_car) {
            return res.status(409).json({
                success: false,
                type: 'warning',
                message: `Car with plate ${plate_number} is already checked in and currently active.`
            });
        }

        let checked_in_by = req.user?.name || "Not specified";

        // --- Look across other models ---
        let driver_name = null;
        let driver_type = "Regular"; // default
        let driver_telephone = null;
        let slot_number = null;

        // 1. StaffCar
        const staff_car = await StaffCar.findOne({ plate_number, is_active: true });
        if (staff_car) {
            driver_name = staff_car.owner_name;
            driver_type = "staff";
        }

        // 2. EmergencyCar (check visitor_info array)
        if (!driver_name) {
            const emergency_car = await EmergencyCar.findOne({
                "visitor_info.plate_number": plate_number
            });
            if (emergency_car) {
                const visitor = emergency_car.visitor_info.find(v => v.plate_number === plate_number);
                if (visitor) {
                    driver_name = visitor.driver_name;
                    driver_type = visitor.driver_type || "visitor";
                    driver_telephone = visitor.telephone_number;
                    slot_number = visitor.slot_number;
                }
            }
        }

        // 3. ServiceDelivery (if visitor already registered with vehicle)
        if (!driver_name) {
            const service_delivery = await ServiceDelivery.findOne({
                "vehicle_storage.has_vehicle": true,
                "vehicle_storage.vehicle_details.plate_number": plate_number
            });
            if (service_delivery) {
                driver_name = service_delivery.full_name;
                driver_type = "visitor";
                driver_telephone = service_delivery.telephone;
            }
        }

        // --- Create ParkingRecord ---
        const new_parking = new ParkingRecord({
            plate_number,
            driver_identification,
            driver_name,
            driver_telephone,
            driver_type,
            slot_number,
            status: 'active',
            check_in: new Date(),
            checked_in_by
        });

        await new_parking.save();

        return res.status(201).json({
            success: true,
            type: "success",
            message: driver_name
                ? `Car checked in successfully. Driver details auto-filled from records.`
                : "Car checked in successfully. Awaiting other-side to complete driver details."
        });

    } catch (error) {
        console.error("Error in car_check_in:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while checking in the car",
            error: error.message
        });
    }
};
