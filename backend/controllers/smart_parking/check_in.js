const ParkingRecord = require('../../models/ParkingRecord');

module.exports = async function car_check_in(req, res, next) {
    try {
        let {
            plate_number = null,
            driver_identification = {} // Now completely optional
        } = req.body || {};

        if (!plate_number) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "Plate number is required"
            });
        }

        // Clean plate number: Uppercase and remove spaces
        plate_number = plate_number.toString().toUpperCase().replace(/\s+/g, '');

        // Check if car is already checked in and active
        const existing_active_car = await ParkingRecord.findOne({ plate_number, status: 'active' });
        
        if (existing_active_car) {
            return res.status(409).json({
                success: false,
                type: 'warning',
                message: `Car with plate ${plate_number} is already checked in and currently active.`
            });
        }

        let checked_in_by = req.user?.name || "Not specified";

        // Create the parking record with minimal data. 
        // The rest will be filled by the reception during visitor check-in.
        const new_parking = new ParkingRecord({
            plate_number,
            driver_identification,
            status: 'active',
            check_in: new Date(),
            checked_in_by
        });

        const saved_parking = await new_parking.save();

        return res.status(201).json({
            success: true,
            type: "success",
            message: "Car checked in successfully. Awaiting reception to complete driver details.",
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