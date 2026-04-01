const ServiceDelivery = require('../../models/service_delivery.js');
const ServiceTracking = require('../../models/service_tracking.js');
const Department = require('../../models/department.js');
const mongoose = require('mongoose');

module.exports = async function toggle_service_status(req, res, next) {
    try {
        let {
            visitor_id = null,
            department_id = null,
            status = null, // 'Inprogress' or 'Completed'
            provider_id = null,
            provider_name = null
        } = req.body || {};

        // Get current user from request (set by auth middleware)
        const currentUser = req.user;

        // Use provided provider info or fall back to current user
        const officerId = provider_id || currentUser?._id || currentUser?.id || currentUser?.employee_id;
        const officerName = provider_name || currentUser?.full_name || currentUser?.fullName || currentUser?.name || 'Unknown Officer';

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



        const user_department_id = req.user?.department_unit || req.user?.department?._id?.toString();
        if (user_department_id !== department_id) {
            return res.status(403).json({
                success: false,
                type: 'warning',
                message: "You do not have permission to update this service status for the specified department."
            });
        }
        // find department in database
        const user_department = await Department.findById(department_id);

        if (!user_department) {
            return res.status(404).json({
                success: false,
                type: 'warning',
                message: "Department not found"
            });
        }

        department_id = user_department._id.toString();


        // 2. Logic for marking as 'Inprogress' (Officer Accepted)
        if (status === 'Inprogress') {
            const current_time = new Date();
            const dept_assign = visitor.departments_assigned.find(d => d.department_id === department_id);

            // check if no department match this and ASSIGN HIM/HER A DEPARTMENT
            if (!dept_assign) {

                visitor.departments_assigned.push({
                    department_id: user_department._id.toString(),
                    department_name: user_department.name,
                    assigned_time: current_time,
                    provider_name: officerName,
                    provider_id: officerId,
                    reached_in: true
                });

                visitor.services_status.push({
                    department_id: user_department._id.toString(),
                    department_name: user_department.department_name,
                    provider_name: officerName,
                    provider_id: officerId,
                    s_type: 'Inprogress'
                });

                await visitor.save();
                return res.status(200).json({
                    success: true,
                    type: "success",
                    message: `Service status successfully changed to ${status} and department assigned`,
                    data: visitor
                });


            }

            //  Find the exact service status to update
            const service_index = visitor.services_status.findIndex(
                s => s.s_type !== 'Completed'
            );


            if (service_index === -1) {
                return res.status(404).json({
                    success: false,
                    type: 'warning',
                    message: `No active service found for department ID ${department_id} to toggle.`
                });
            }

            const active_service = visitor.services_status[service_index];

            active_service.s_type = 'Inprogress';

            // Set the provider/officer info who accepted/started the service
            active_service.provider_id = officerId;
            active_service.provider_name = officerName;

            // Also update departments_assigned if exists
            if (dept_assign) {
                dept_assign.reached_in = true;
                dept_assign.provider_id = officerId;
                dept_assign.provider_name = officerName;
            }
        }



        //  Logic for marking as 'Completed'
        if (status === 'Completed') {
            const assigned_dept = visitor.departments_assigned.find(d => d.department_id === department_id);
            if (!assigned_dept) {
                return res.status(400).json({
                    success: false,
                    type: 'warning',
                    message: "Department assigned not found!"
                });
            }
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
                provider_name: officerName,
                provider_id: officerId
            });

            // C. Also update the services_status with final provider info
            active_service.provider_id = officerId;
            active_service.provider_name = officerName;

            active_service.s_type = 'Completed';
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