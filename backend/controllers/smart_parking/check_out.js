const ParkingRecord = require('../../models/parking_record.js');
const ServiceDelivery = require('../../models/service_delivery.js');

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
        const parked_minutes = Math.round((current_time - new Date(parking_session.check_in)) / 60000);

        // Finalize parking record
        parking_session.status = 'completed';
        parking_session.check_out = current_time;
        parking_session.duration = `${parked_minutes} mins`;

        await parking_session.save();


        const pending_visitor = await ServiceDelivery.findOne({
            "vehicle_storage.has_vehicle": true,
            "vehicle_storage.vehicle_details.plate_number": plate_number
        });


        if (pending_visitor) {
            pending_visitor.is_still_inhouse = false;
            pending_visitor.vehicle_storage.vehicle_details.exited_time = current_time;
            pending_visitor.vehicle_storage.vehicle_details.duration = `${parked_minutes} mins`;


            await pending_visitor.save();
        }

        return res.status(200).json({
            success: true,
            type: "success",
            message: pending_visitor ? "Car and associated Visitor successfully checked out." : "Car checked out successfully.",

        });

    } catch (error) {
        console.error("Error in car_check_out:", error);
        return res.status(500).json({ success: false, type: "error", message: "Failed to check out car", error: error.message });
    }
};