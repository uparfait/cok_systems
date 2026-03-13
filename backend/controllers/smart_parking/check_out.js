const ParkingRecord = require('../../models/parking_record.js');
const ServiceDelivery = require('../../models/service_delivery.js');

const StaffCar = require('../../models/staff_car.js'); // 👉 Added this path
const FlaggedVehicle = require('../../models/flagged_vehicle.js'); // 👉 new model

module.exports = async function car_check_out(req, res, next) {
    try {
        let { plate_number = null } = req.body || {};

        if (!plate_number) {
            return res.status(400).json({ success: false, type: 'warning', message: "Plate number required" });
        }

        plate_number = plate_number.toString().toUpperCase().replace(/\s+/g, '');

        // Find the active parking session
        const parking_session = await ParkingRecord.findOne({ plate_number, status: 'active' });

        if (!parking_session) {
            return res.status(404).json({
                success: false,
                type: 'warning',
                message: "No active parking record found for this plate number."
            });
        }

        const current_time = new Date();
        const check_in_time = new Date(parking_session.check_in); // added this line for checkin time
        const parked_minutes = Math.round((current_time - new Date(parking_session.check_in)) / 60000);

        // Finalize parking record
        parking_session.status = 'completed';
        parking_session.check_out = current_time;
        parking_session.duration = `${parked_minutes} mins`;

        await parking_session.save();


        const pending_visitor = await ServiceDelivery.findOne({
            $or: [
                { "vehicle_storage.has_vehicle": true, "vehicle_storage.vehicle_details.plate_number": plate_number },
                { "vehicle_storage.has_vehicle": false, full_name: parking_session.driver_name, is_still_inhouse: true }
            ]
        });


        if (pending_visitor) {
            pending_visitor.is_still_inhouse = false;
            
            // Only update vehicle details if they have a vehicle
            if (pending_visitor.vehicle_storage?.has_vehicle && pending_visitor.vehicle_storage?.vehicle_details) {
                pending_visitor.vehicle_storage.vehicle_details.exited_time = current_time;
                pending_visitor.vehicle_storage.vehicle_details.duration = `${parked_minutes} mins`;
            }
            
            await pending_visitor.save();
        }

        // ================================================================
        // 👉 NEW AUTOMATED FLAGGING LOGIC 
        // ================================================================
        
        let allowed_duration_minutes = 120; // Default: 2 hours for visitors
        let is_flagged = false;
        let final_message = "Vehicle checked out successfully.";     
        // Determine if it's staff to override the allowed time
        if (!pending_visitor) {
            const staff_member = await StaffCar.findOne({ plate_number });
            if (staff_member) {
                allowed_duration_minutes = 720; // Default: 12 hours for staff
            }
        }

        // Do the math: Did they overstay?
        if (parked_minutes > allowed_duration_minutes) {
            is_flagged = true;
            const flagged_duration = parked_minutes - allowed_duration_minutes;
            const exact_flagged_time = new Date(check_in_time.getTime() + (allowed_duration_minutes * 60000));

            // 👉 Save the permanent receipt, copying rich data from parking_session!
            const violation = new FlaggedVehicle({
                plate_number: plate_number,
                
                // Copying context from the original parking record
                driver_type: parking_session.driver_type || 'Visitor', // Fallback just in case
                driver_name: parking_session.driver_name,
                driver_telephone: parking_session.driver_telephone,
                driver_identification: parking_session.driver_identification,
                slot_number: parking_session.slot_number,
                checked_in_by: parking_session.checked_in_by,
                
                // The Timeline & Math
                check_in_time: check_in_time,
                flagged_at: exact_flagged_time,
                check_out_time: current_time,
                allowed_duration_minutes: allowed_duration_minutes,
                total_duration_minutes: parked_minutes,
                flagged_duration_minutes: flagged_duration
            });

            await violation.save();
            console.log(`[SECURITY] Vehicle ${plate_number} automatically flagged at checkout for overstaying by ${flagged_duration} minutes.`);

            // Populate the violation details for the frontend response
            violation_details = {
                allowed_minutes: allowed_duration_minutes,
                total_minutes: parked_minutes,
                overstayed_minutes: flagged_duration,
                Violation_details: null
            };
            
            final_message = `Vehical checked out. WARNING: Vehicle overstayed by ${flagged_duration} minutes.`;
        }
        // ================================================================

        return res.status(200).json({
            success: true,
            type: is_flagged ? "info" : "success", 
            message: final_message,
            data: {
                plate_number: plate_number,
                driver_type: parking_session.driver_type || "Not Specified",
                driver_name: parking_session.driver_name || "Not Specified",
                driver_telephone: parking_session.driver_telephone || "Not Specified",
                check_in_time: check_in_time,
                check_out_time: current_time,
                total_duration: `${parked_minutes} mins`,
                is_flagged: is_flagged,
                violation_details: violation_details
            }
        });

    } catch (error) {
        console.error("Error in car_check_out:", error);
        return res.status(500).json({ success: false, type: "error", message: "Failed to check out car", error: error.message });
    }
};