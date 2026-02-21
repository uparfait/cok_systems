const StaffCar = require('../../models/staff_car.js');
const EmergencyCar = require('../../models/emergency_car.js');
const ParkingRecord = require('../../models/parking_record.js');

module.exports = async function verify_car(req, res, next) {
    try {
        let { plate_number = null } = req.body || {};

        if (!plate_number) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "Plate number is required for verification"
            });
        }

        plate_number = plate_number.toString().toUpperCase().replace(/\s+/g, '');

        //  Check if it's currently parked
        const active_parking = await ParkingRecord.findOne({ plate_number, status: 'active' });

        //  Check if it's a registered Staff Car
        const staff_car = await StaffCar.findOne({ plate_number, is_active: true });

        //  Check if it's a reserved Emergency/Visitor Car
        // We look inside the visitor_info array of the EmergencyCar model
        const emergency_reservation = await EmergencyCar.findOne({
            "visitor_info.plate_number": plate_number,
            "validity.to": { $gte: new Date() } // Ensure reservation hasn't expired
        });

        let vehicle_type = 'Unknown';
        let is_reserved = false;

        if (staff_car) {
            vehicle_type = 'Staff';
            is_reserved = true;
        } else if (emergency_reservation) {
            vehicle_type = 'Visitor';
            is_reserved = true;
        }

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Vehicle verified successfully",
            data: {
                plate_number,
                is_currently_parked: !!active_parking,
                parking_details: active_parking || null,
                vehicle_category: vehicle_type,
                is_reserved: is_reserved,
                staff_details: staff_car || null,
                emergency_reservation_details: emergency_reservation.visitor_info || null
            }
        });

    } catch (error) {
        console.error("Error in verify_car:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while verifying the car",
            error: error.message
        });
    }
};