const ServiceDelivery = require('../../models/service_delivery.js');
const ServiceTracking = require('../../models/service_tracking.js');
const Department = require('../../models/department.js');
const mongoose = require('mongoose');

module.exports = async function toggle_service_status(req, res, next) {
    try {
        let {
            visitor_id = null,
            status = null, // 'Inprogress', 'Transfered' or 'Completed'
            notes = null,

        } = req.body || {};


        // Get current user from request (set by auth middleware)
        const currentUser = req.user;

        // Use provided provider info or fall back to current user
        const officerId =  currentUser?._id || currentUser?.id || currentUser?.employee_id;
        const officerName =  currentUser?.full_name || currentUser?.fullName || currentUser?.name || 'Unknown Officer';

        if (!visitor_id || !status) {
            return res.status(400).json({
                success: false,
                type: 'warning',
                message: "Visitor ID and Status are required"
            });
        }

        if (!['Inprogress', 'Completed', 'Transfered'].includes(status)) {
            return res.status(400).json({ success: false, type: 'warning', message: "Status must be 'Inprogress', 'Completed', or 'Transfered'" });
        }

        const visitor = await ServiceDelivery.findById(visitor_id);

        

        if (!visitor || !visitor.is_still_inhouse) {
            return res.status(404).json({ success: false, type: 'warning', message: "Active visitor not found" });
        }



        const user_department_id =  req.user?.department?._id?.toString();
        const user_department_unit_id = req.user?.department_unit?._id?.toString();
       
        // find department in database
        const user_department_parent = await Department.findById(user_department_id);
        const user_department_unit = await Department.findById(user_department_unit_id);

        const user_department = user_department_unit || user_department_parent;

        if (!user_department) {
            return res.status(404).json({
                success: false,
                type: 'warning',
                message: "Department not found"
            });
        }

       let department_id = user_department._id.toString();


        // 2. Logic for marking as 'Inprogress' (Officer Accepted)
        if (status === 'Inprogress') {

            if(visitor.is_being_served) {
                return res.status(400).json({
                    success: false,
                    type: 'warning',
                    message: "Visitor is already being served by another part!"
                });
            }
            const current_time = new Date();
            const dept_assign = visitor.departments_assigned.find(d => d.department_id.toString() === department_id);

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

                visitor.is_being_served = true;

                visitor.services_status.splice(
                    0,
                    visitor.services_status.length,
                    {
                        department_id: user_department._id.toString(),
                        department_name: user_department.department_name,
                        provider_name: officerName,
                        provider_id: officerId,
                        s_type: 'Inprogress'
                    }
                );

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
                    message: `No active service found`
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
            visitor.is_being_served = true;

            visitor.durations.services_durations.splice(
                0,
                visitor.durations.services_durations.length,
                {
                    department_id: active_service.department_id,
                    department_name: active_service.department_name,
                    started_at: current_time,
                    ended_at: null,
                    duration: null,
                    provider_name: officerName,
                    provider_id: officerId
                }
            );
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

              //  Find the exact service status to update
            const service_index = visitor.services_status.findIndex(
                s => s.s_type !== 'Completed'
            );


            if (service_index === -1) {
                return res.status(404).json({
                    success: false,
                    type: 'warning',
                    message: `No active service found`
                });
            }



            const active_service = visitor.services_status[service_index];

            const current_time = new Date();


            // check if the one who is going to stop the service is the one who started it.
            if(assigned_dept?.provider_id?.toString() !== officerId?.toString()){
                return res.status(403).json({
                    success: false,
                    type: 'warning',
                    message: 'Service can only be stopped by someone who started it.'
                });
             }
            // Find the start time from durations
            const currentServiceDuration = visitor.durations.services_durations.find(
                d => d.provider_id.toString() === officerId.toString() && d.ended_at === null
            );
            const start_time = currentServiceDuration ? currentServiceDuration.started_at : (assigned_dept ? assigned_dept.assigned_time : visitor.entry_date);

            const duration_minutes = Math.round(( new Date() - new Date(start_time)) / 60000);
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

            // B. Update the existing duration entry
            const durationIndex = visitor.durations.services_durations.findIndex(
                d => d.provider_id.toString() === officerId.toString() && d.ended_at === null
            );
            if (durationIndex !== -1) {
                visitor.durations.services_durations[durationIndex].ended_at = current_time;
                visitor.durations.services_durations[durationIndex].duration = duration_str;
            }

            // C. Also update the services_status with final provider info
            active_service.provider_id = officerId;
            active_service.provider_name = officerName;

            active_service.s_type = 'Completed';
            visitor.is_being_served = false;


            // so remove any other service which is not  completed
            visitor.services_status = visitor.services_status.filter(s => s.s_type === 'Completed');

            

            if(notes) {
                visitor.notes.push({
                    writter_name: officerName,
                    message: notes,
                    timestamp: new Date().toLocaleDateString()
                });
            }
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