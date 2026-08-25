const mongoose = require('mongoose');
const ServiceDelivery = require('../../models/service_delivery.js');
const ParkingRecord = require('../../models/parking_record.js');
const ServiceTracking = require('../../models/service_tracking.js');
const { notifyUsers } = require('../../utilities/notify.js');

/**
 * Handles full visitor checkout when no active car/parking record exists.
 */
async function CheckOutBecauseCarNotFound(visitor, req, res) {
    const current_time = new Date();
    const { items_exited_with = [] } = req.body || {};

    visitor.exist_date = current_time;
    if (items_exited_with.length > 0) {
        visitor.items_exited_with = items_exited_with;
    }

    // Calculate total entry-to-leave duration
    const total_minutes = Math.round((current_time - new Date(visitor.entry_date)) / 60000);
    visitor.durations = visitor.durations || {};
    visitor.durations.entry_and_leave_duration = `${total_minutes} mins`;

    // Mark visitor as checked out
    visitor.is_still_inhouse = false;

    // Complete all in-progress services and record tracking
    const active_services = (visitor.services_status || []).filter(s => s.s_type === 'Inprogress');

    for (let active_service of active_services) {
        const assigned_dept = (visitor.departments_assigned || []).find(
            d => d.department_id?.toString() === active_service.department_id?.toString()
        );
        const start_time = assigned_dept ? assigned_dept.assigned_time : visitor.entry_date;
        const duration_minutes = Math.round((current_time - new Date(start_time)) / 60000);

        // Save to ServiceTracking Model
        await ServiceTracking.create({
            department_id: active_service.department_id,
            department_name: active_service.department_name,
            duration: `${duration_minutes} mins`,
            started_at: start_time,
            ended_at: current_time,
            provider_name: active_service.provider_name || 'Not specified',
            provider_id: active_service.provider_id || 'Not specified'
        });

        // Warn the provider that they forgot to stop the service
        if (active_service.provider_id) {
            notifyUsers({
                event: 'you_forgot_to_stop_service',
                to: [active_service.provider_id],
                type: 'warning',
                title: 'Service was not stopped',
                message: `You forgot to stop the service for visitor ${visitor.full_name} in department ${active_service.department_name}. We stopped it for you. Please be careful next time.`,
                data: { visitor_id: String(visitor._id), department_name: active_service.department_name },
            }).catch((err) => console.error('Failed to notify provider:', err.message));
        }

        active_service.s_type = 'Completed';
    }

    const updated_visitor = await visitor.save();

    // Broadcast checkout event
    global.WebsocketIO?.emit('visitor_checkedout', {
        show_notif: false,
        type: 'info',
        message: `Visitor ${visitor.full_name} checked out.`
    });

    return res.status(200).json({
        success: true,
        type: 'success',
        message: 'No active vehicle found. Visitor checked out completely.',
        data: updated_visitor
    });
}

module.exports = async function partial_exit(req, res, next) {
    try {
        const { visitor_id } = req.body || {};

        if (!visitor_id) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: 'Visitor ID is required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(visitor_id)) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: 'Invalid Visitor ID format'
            });
        }

        const visitor = await ServiceDelivery.findById(visitor_id);

        if (!visitor || !visitor.is_still_inhouse) {
            return res.status(404).json({
                success: false,
                type: 'warning',
                message: 'Visitor not found or already checked out'
            });
        }

        // Search for active car/parking records tied to this visitor
        let activeParkingRecords = [];

        if (visitor.identification?.number) {
            const idRecords = await ParkingRecord.find({
                'driver_identification.number': visitor.identification.number,
                status: 'active'
            });
            activeParkingRecords.push(...idRecords);
        }

        if (visitor.vehicle_storage?.has_vehicle && visitor.vehicle_storage?.vehicle_details?.plate_number) {
            const plateRecords = await ParkingRecord.find({
                plate_number: visitor.vehicle_storage.vehicle_details.plate_number,
                status: 'active'
            });

            for (const plateRecord of plateRecords) {
                const alreadyExists = activeParkingRecords.some(
                    r => r._id.toString() === plateRecord._id.toString()
                );
                if (!alreadyExists) {
                    activeParkingRecords.push(plateRecord);
                }
            }
        }

        // IF NO CAR/PARKING RECORD EXISTS: Perform full visitor checkout
        if (activeParkingRecords.length === 0) {
            return await CheckOutBecauseCarNotFound(visitor, req, res);
        }

        // IF CAR EXISTS: Perform regular partial exit logic
        visitor.badge_number = null;
        visitor.marked_as_out = true;
        await visitor.save();

        let parkingRecordsUpdated = [];
        for (const parkingRecord of activeParkingRecords) {
            parkingRecord.badge_number = null;
            await parkingRecord.save();
            parkingRecordsUpdated.push(parkingRecord);
        }

        return res.status(200).json({
            success: true,
            type: 'success',
            message: 'Visitor marked as outside',
            data: visitor,
            parking_records_updated: parkingRecordsUpdated.length
        });

    } catch (error) {
        console.error('Error in partial_exit:', error);
        return res.status(500).json({
            success: false,
            type: 'error',
            message: 'Failed to process partial exit',
            error: error.message
        });
    }
};