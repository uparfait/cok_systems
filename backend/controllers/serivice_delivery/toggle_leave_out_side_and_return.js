const ServiceDelivery = require('../../models/service_delivery.js');

module.exports = async function toggle_temporary_leave(req, res, next) {
    try {
        let {
            visitor_id = null,
            action = null, // 'leave' or 'return'
            items_exited_with = [], // E.g. [{ item_name: "Laptop", quantity: 1 }]
            provider_name = req.user?.name || 'Not Specified',
            provider_id = null,
            message = null
        } = req.body || {};

        if (!visitor_id || !action) {
            return res.status(400).json({ success: false, type: 'warning', message: "Visitor ID and Action ('leave' or 'return') required" });
        }

        const visitor = await ServiceDelivery.findById(visitor_id);
        if (!visitor || !visitor.is_still_inhouse) {
            return res.status(404).json({ success: false, type: 'warning', message: "Active visitor not found" });
        }

        // check if a vistor has a vehicle if not respond with this action require a visitor who have a vehicle

        if (!visitor.vehicle_storage?.has_vehicle) {
            return res.status(400).json({ success: false, type: 'warning', message: "This action requires a visitor with a vehicle." });
        }

        const current_time = new Date();

        if (action.toLowerCase() === 'leave') {
            // Check if they are already outside
            const is_already_outside = visitor.durations.emergency_durations.some(e => e.type_of_emergency === 'Leave outside' && !e.ended_at);
            if (is_already_outside) {
                return res.status(400).json({ success: false, type: 'warning', message: "Visitor is already marked as outside." });
            }

            // Start the emergency duration clock
            visitor.durations.emergency_durations.push({
                type_of_emergency: 'Leave outside',
                started_at: current_time,
                provider_name,
                provider_id
            });

            // Update items exited with
            if (items_exited_with.length > 0) {
                visitor.items_exited_with.push(...items_exited_with);
            }

            visitor.notes.push({
                writter_name: provider_name,
                message: message || 'Visitor stepped outside temporarily.',
                timestamp: current_time
            });
            visitor.marked_as_out = true;

        } else if (action.toLowerCase() === 'return') {
            // Find the open 'Leave outside' record
            const open_leave_index = visitor.durations.emergency_durations.findIndex(e => e.type_of_emergency === 'Leave outside' && !e.ended_at);
            
            if (open_leave_index === -1) {
                return res.status(400).json({ success: false, type: 'warning', message: "No active 'Leave outside' record found to close." });
            }

            const active_leave = visitor.durations.emergency_durations[open_leave_index];
            active_leave.ended_at = current_time;
            
            // Calculate minutes
            const duration_minutes = Math.round((current_time - new Date(active_leave.started_at)) / 60000);
            active_leave.duration = `${duration_minutes} mins`;

            visitor.notes.push({
                writter_name: provider_name,
                message: message || `Visitor returned inside after ${duration_minutes} minutes.`,
                timestamp: current_time
            });
            visitor.marked_as_out = false;
        } else {
            return res.status(400).json({ success: false, type: 'warning', message: "Invalid action. Use 'leave' or 'return'." });
        }

        const updated_visitor = await visitor.save();


        if (global.WebsocketIO) {
            global.WebsocketIO.to('SYSTEM_service_delivery').emit('leave_return', { 
                show_notif: true,
                type: 'info',
                message: "Visitor " + visitor.full_name + " With plate number " + visitor.vehicle_storage?.vehicle_details?.plate_number + " has " + (action.toLowerCase() === 'leave' ? "stepped outside temporarily." : "returned inside.")
             });
        }

        return res.status(200).json({
            success: true,
            type: "success",
            message: action === 'leave' ? "Visitor marked as temporarily outside." : "Visitor marked as returned.",
            data: updated_visitor
        });

    } catch (error) {
        console.error("Error in toggle_temporary_leave:", error);
        return res.status(500).json({ success: false, type: "error", message: "Failed to log temporary leave", error: error.message });
    }
};