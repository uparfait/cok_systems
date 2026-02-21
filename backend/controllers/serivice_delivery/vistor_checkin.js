const ServiceDelivery = require('../../models/service_delivery.js');
const ParkingRecord = require('../../models/parking_record.js');

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
            departments_assigned = [],
            services_status = []
        } = req.body || {};

        // Identification is no longer strictly required
        if (!full_name) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "Full name is required for visitor registration"
            });
        }

        // --- CAR  ---
        if (vehicle_storage.has_vehicle && vehicle_storage.vehicle_details?.plate_number) {
            
            // Clean plate number
            let plate = vehicle_storage.vehicle_details.plate_number.toString().toUpperCase().replace(/\s+/g, '');
            vehicle_storage.vehicle_details.plate_number = plate;
            
            // Look for the car
            const active_parking = await ParkingRecord.findOne({ plate_number: plate, status: 'active' });
            
            if (active_parking) {
                // 1. Fill out the missing parking record fields with the visitor's data
                active_parking.driver_name = full_name;
                active_parking.driver_telephone = telephone || 'Not specified';
                active_parking.driver_type = 'Regular';
                
                // If the gate guard missed the ID but reception got it, update it here
                if (identification && identification.id_type && (!active_parking.driver_identification || !active_parking.driver_identification.number)) {
                    active_parking.driver_identification = identification;
                }
                
                await active_parking.save();

                // 2. Sync the visitor's 'entered_time' with the exact time the gate opened
                vehicle_storage.vehicle_details.entered_time = active_parking.check_in;
            } else {
                // Fallback: If they claim a car but it wasn't scanned at the gate yet
                vehicle_storage.vehicle_details.entered_time = new Date();
            }
        } else {
            // Ensure clean data if no car is claimed
            vehicle_storage = { has_vehicle: false };
        }

        let registered_by = req.user?.name || "Not specified";

        const new_visitor = new ServiceDelivery({
            full_name,
            telephone,
            email,
            identification,
            gender,
            vehicle_storage,
            items_entered_with,
            departments_assigned,
            services_status,
            is_still_inhouse: true,
            entry_date: new Date(),
            registered_by
        });

        const saved_visitor = await new_visitor.save();

        return res.status(201).json({
            success: true,
            type: "success",
            message: "Visitor checked in successfully",
            data: saved_visitor
        });

    } catch (error) {
        console.error("Error in visitor_checkin:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while checking in visitor",
            error: error.message
        });
    }
};