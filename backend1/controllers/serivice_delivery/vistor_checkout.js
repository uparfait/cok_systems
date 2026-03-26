const ServiceDelivery = require('../../models/service_delivery.js');
const ParkingRecord = require('../../models/parking_record.js');
const ServiceTracking = require('../../models/service_tracking.js');
const mongoose = require('mongoose');

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

            // if is car still parked stop from deny checkout
            if (active_parking) {
                return res.status(200).json({
                    success: true,
                    type: 'warning',
                    message: "Action denied this vistor has a car please user Vehicle link at left sidebar",
                    data: visitor
                });
            }
        }

        if (is_car_still_parked) {
            // We keep is_still_inhouse = true because the car is still here
        } else {
            // Full checkout
            visitor.is_still_inhouse = false;
        }

        // check if there is any working service and desable it as below codes doese

        // cancled all active services and store into service tracking if ignored use as above code

        let active_services = visitor.services_status.filter(s => s.s_type === 'Inprogress');
        for (let active_service of active_services) {
            const current_time = new Date();
            const assigned_dept = visitor.departments_assigned.find(d => d.department_id === active_service.department_id);
            const start_time = assigned_dept ? assigned_dept.assigned_time : visitor.entry_date;
            const duration_minutes = Math.round((current_time - new Date(start_time)) / 60000);
            const duration_str = `${duration_minutes} mins`;

            //  Save to ServiceTracking Model
            await ServiceTracking.create({
                department_id: active_service.department_id,
                department_name: active_service.department_name,
                duration: duration_str,
                started_at: start_time,
                ended_at: current_time,
                provider_name: active_service.provider_name || 'Not specified',
                provider_id: active_service.provider_id || 'Not specified'
            });

            // check if provider id exists and announce to him/her that forgot too stop service but stopped

            if (active_service.provider_id) {

                global.WebsocketIO?.emit('you_forgot_to_stop_service', {
                    show_notif: true,
                    type: 'warning',
                    to: active_service.provider_id,
                    visitor_id: visitor._id,
                    message: `You forgot to stop the service for visitor ${visitor.full_name} in department ${active_service.department_name}. We stopped it for you but please be careful next time.`
                })

            }

            // Update the service status to 'Completed'
            active_service.s_type = 'Completed';
        }

        const updated_visitor = await visitor.save();

        global.WebsocketIO?.emit('visitor_checkedout', {
            show_notif: is_car_still_parked,
            type: is_car_still_parked ? 'warning' : 'info',
            message: is_car_still_parked ? `Visitor ${visitor.full_name} checked-out. But car still parked` : `Visitor ${visitor.full_name} checked out.`
        })

        return res.status(200).json({
            success: true,
            type: is_car_still_parked ? 'warning' : 'success',
            message: is_car_still_parked ? "Visitor checked-out. But car still parked." : "Visitor checked out.",
            data: updated_visitor
        });

    } catch (error) {
        console.error("Error in visitor_checkout:", error);
        return res.status(500).json({ success: false, type: "error", message: "Checkout failed", error: error.message });
    }
};