const ServiceDelivery = require('../../models/service_delivery.js');
const mongoose = require('mongoose');

module.exports = async function transfer_visitor(req, res, next) {
    try {
        let {
            visitor_id = null,
            new_department_id = null,
            new_department_name = null,
            reason_for_transfer = 'Transifer to another department'
        } = req.body || {};

        if (!visitor_id) {
            return res.status(400).json({ success: false, type: 'warning', message: "Missing vistor id" });
        }

        const visitor = await ServiceDelivery.findById(visitor_id);
        if (!visitor || !visitor.is_still_inhouse) {
            return res.status(404).json({ success: false, type: 'warning', message: "Active visitor not found" });
        }

        const current_time = new Date();
        const active_service_index = visitor.services_status.findIndex(s => s.type === 'Inprogress' || s.type === 'Not started');

        if (active_service_index !== -1) {
            const active_service = visitor.services_status[active_service_index];
            const assigned_dept = visitor.departments_assigned.find(d => d.department_id === active_service.department_id);
            const start_time = assigned_dept ? assigned_dept.assigned_time : visitor.entry_date;
            
            // Calculate minutes
            const duration_minutes = Math.round((current_time - new Date(start_time)) / 60000);

            // Log the transfer duration
            visitor.durations.emergency_durations.push({
                type_of_emergency: reason_for_transfer,
                duration: `${duration_minutes} mins`,
                started_at: start_time,
                ended_at: current_time,
                provider_name: active_service.provider_name,
                provider_id: active_service.provider_id
            });

            // Mark current as transferred
            visitor.services_status[active_service_index].type = 'Transfered';
        }

        // Create new assignment
        visitor.departments_assigned.push({
            department_id: new_department_id,
            department_name: new_department_name,
            assigned_time: current_time
        });

        visitor.services_status.push({
            department_id: new_department_id,
            department_name: new_department_name,
            type: 'Not started'
        });

        const updated_visitor = await visitor.save();

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Visitor transferred successfully",
            data: updated_visitor
        });

    } catch (error) {
        console.error("Error in transfer_visitor:", error);
        return res.status(500).json({ success: false, type: "error", message: "Failed to transfer visitor", error: error.message });
    }
};