const ServiceDelivery = require('../../models/service_delivery.js');
const ServiceTracking = require('../../models/service_tracking.js');
const mongoose = require('mongoose');

module.exports = async function toggle_service_status(req, res, next) {
    try {
        let {
            visitor_id = null,
            department_id = null,
            status = null // 'Inprogress' or 'Completed'
        } = req.body || {};

        if (!visitor_id || !department_id || !status) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "Visitor ID, Department ID, and Status are required"
            });
        }

        if (!['Inprogress', 'Completed'].includes(status)) {
            return res.status(400).json({ success: false, type: 'warning', message: "Status must be 'Inprogress' or 'Completed'" });
        }

        const visitor = await ServiceDelivery.findById(visitor_id);
        
        if (!visitor || !visitor.is_still_inhouse) {
            return res.status(404).json({ success: false, type: 'warning', message: "Active visitor not found" });
        }

        // 1. Find the exact service status to update
        const service_index = visitor.services_status.findIndex(
            s => s.department_id === department_id && s.type !== 'Completed' && s.type !== 'Transfered'
        );

        if (service_index === -1) {
            return res.status(404).json({
                success: false,
                type: 'warning',
                message: `No active service found for department ID ${department_id} to toggle.`
            });
        }

        const active_service = visitor.services_status[service_index];
        const current_time = new Date();

        // 2. Logic for marking as 'Inprogress'
        if (status === 'Inprogress') {
            active_service.type = 'Inprogress';
            
            // Mark reached_in as true in departments_assigned
            const dept_assign = visitor.departments_assigned.find(d => d.department_id === department_id);
            if (dept_assign) dept_assign.reached_in = true;
        }

        // 3. Logic for marking as 'Completed'
        if (status === 'Completed') {
            const assigned_dept = visitor.departments_assigned.find(d => d.department_id === department_id);
            const start_time = assigned_dept ? assigned_dept.assigned_time : visitor.entry_date;
            
            const duration_minutes = Math.round((current_time - new Date(start_time)) / 60000);
            const duration_str = `${duration_minutes} mins`;

            // A. Save to ServiceTracking Model
            await ServiceTracking.create({
                department_id: active_service.department_id,
                department_name: active_service.department_name,
                duration: duration_str,
                started_at: start_time,
                ended_at: current_time,
                provider_name: active_service.provider_name,
                provider_id: active_service.provider_id
            });

            // B. Push to visitor's durations array
            visitor.durations.services_durations.push({
                department_id: active_service.department_id,
                department_name: active_service.department_name,
                duration: duration_str,
                started_at: start_time,
                ended_at: current_time,
                provider_name: active_service.provider_name,
                provider_id: active_service.provider_id
            });

            active_service.type = 'Completed';
        }

        const updated_visitor = await visitor.save();

        return res.status(200).json({
            success: true,
            type: "success",
            message: `Service status successfully changed to ${status}`,
            data: updated_visitor
        });

    } catch (error) {
        console.error("Error in toggle_service_status:", error);
        return res.status(500).json({ success: false, type: "error", message: "Failed to update service status", error: error.message });
    }
};