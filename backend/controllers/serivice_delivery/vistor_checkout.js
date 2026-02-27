const ServiceDelivery = require('../../models/service_delivery.js');
const ParkingRecord = require('../../models/parking_record.js');

module.exports = async function visitor_checkout(req, res, next) {
    try {
        let { visitor_id = null, items_exited_with = [] } = req.body || {};

        if (!visitor_id) {
            return res.status(400).json({ success: false, type: 'warning', message: "Visitor ID required" });
        }

        const visitor = await ServiceDelivery.findById(visitor_id);
        
        if (!visitor || !visitor.is_still_inhouse) {
            return res.status(404).json({ success: false, type: 'warning', message: "Visitor not found or already checked out" });
        }

        const current_time = new Date();
        visitor.exist_date = current_time;
        if (items_exited_with.length > 0) visitor.items_exited_with = items_exited_with;

        // Calculate total entry-to-leave duration
        const total_minutes = Math.round((current_time - new Date(visitor.entry_date)) / 60000);
        visitor.durations.entry_and_leave_duration = `${total_minutes} mins`;

        // Check if they have a car that is STILL parked
        let is_car_still_parked = false;
        if (visitor.vehicle_storage.has_vehicle && visitor.vehicle_storage.vehicle_details?.plate_number) {
            const active_parking = await ParkingRecord.findOne({ 
                plate_number: visitor.vehicle_storage.vehicle_details.plate_number, 
                status: 'active' 
            });
            if (active_parking) is_car_still_parked = true;
        }

        if (is_car_still_parked) {
            // We keep is_still_inhouse = true because the car is still here
        } else {
            // Full checkout
            visitor.is_still_inhouse = false;
        }

        const updated_visitor = await visitor.save();

        return res.status(200).json({
            success: true,
            type: "success",
            message: is_car_still_parked ? "Visitor marked as pending. Awaiting vehicle checkout." : "Visitor fully checked out.",
            data: updated_visitor
        });

    } catch (error) {
        console.error("Error in visitor_checkout:", error);
        return res.status(500).json({ success: false, type: "error", message: "Checkout failed", error: error.message });
    }
};