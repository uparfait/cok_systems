const ServiceDelivery = require('../../models/service_delivery.js');
const ServiceTracking = require('../../models/service_tracking.js');
const mongoose = require('mongoose');

module.exports = async function assign_visitor_to_department(req, res, next) {
    try {
        let {
            visitor_id = null,
            new_department_id = null,
            new_department_name = null,
            provider_name = 'Not specified',
            provider_id = null,
            previous_department_id = null
        } = req.body || {};

        if (!visitor_id || !new_department_id || !new_department_name) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "Visitor ID, New Department ID, and New Department Name are required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(visitor_id)) {
            return res.status(400).json({ success: false, type: 'warning', message: "Invalid Visitor ID" });
        }

        const visitor = await ServiceDelivery.findById(visitor_id);
        
        if (!visitor || !visitor.is_still_inhouse) {
            return res.status(404).json({ success: false, type: 'warning', message: "Visitor not found or has already left." });
        }

        const current_time = new Date();

        // ONLY close the previous service if its ID strictly matches the one provided in the request
        if (previous_department_id) {
            const active_service_index = visitor.services_status.findIndex(
                s => s.department_id === previous_department_id && s.type !== 'Completed'
            );

            if (active_service_index !== -1) {
                const active_service = visitor.services_status[active_service_index];
                
                const assigned_dept = visitor.departments_assigned.find(d => d.department_id === previous_department_id);
                const start_time = assigned_dept ? assigned_dept.assigned_time : visitor.entry_date;
                
                const duration_minutes = Math.round((current_time - new Date(start_time)) / 60000);
                const duration_str = `${duration_minutes} mins`;

                await ServiceTracking.create({
                    department_id: active_service.department_id,
                    department_name: active_service.department_name,
                    duration: duration_str,
                    started_at: start_time,
                    ended_at: current_time,
                    provider_name: active_service.provider_name,
                    provider_id: active_service.provider_id
                });

                visitor.durations.services_durations.push({
                    department_id: active_service.department_id,
                    department_name: active_service.department_name,
                    duration: duration_str,
                    started_at: start_time,
                    ended_at: current_time,
                    provider_name: active_service.provider_name,
                    provider_id: active_service.provider_id
                });

                visitor.services_status[active_service_index].type = 'Transfered';
            }
        }

        // Assign the new department
        visitor.departments_assigned.push({
            department_id: new_department_id,
            department_name: new_department_name,
            assigned_time: current_time,
            provider_name,
            provider_id,
            reached_in: false
        });

        visitor.services_status.push({
            department_id: new_department_id,
            department_name: new_department_name,
            provider_name,
            provider_id,
            type: 'Not started'
        });

        const updated_visitor = await visitor.save();

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Visitor successfully assigned to new department",
            data: updated_visitor
        });

    } catch (error) {
        console.error("Error in assign_visitor:", error);
        return res.status(500).json({ success: false, type: "error", message: "Failed to assign visitor", error: error.message });
    }
};