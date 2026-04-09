const ServiceDelivery = require("../../models/service_delivery.js");
const Department = require("../../models/department.js");

module.exports = async function get_active_tasks(req, res, next) {
    try {
        let { limit = 10, page = 1, search = "" } = req.query || {};

        let user_role_name = req.user?.role_name;

        if (user_role_name !== "Head of department") {
            return res.status(403).json({
                success: false,
                type: "error",
                message: "Access denied. Only Head of Department can view active tasks.",
            });
        }

        const limit_val = Math.min(parseInt(limit), 50);
        const skip_val = (parseInt(page) - 1) * limit_val;

        // Find the department where the user is the leader
        const department = await Department.findOne({
            department_leader: req.user.id,
        });

        if (!department) {
            return res.status(403).json({
                success: false,
                type: "error",
                message: "You are not assigned as a leader of any department",
            });
        }

        let department_ids = [];
        if (department.sub_department_mng?.is_sub_department) {
            department_ids = [department._id.toString()];
        } else {
            // Not a sub department, find its sub departments and include them
            const sub_departments = await Department.find({
                "sub_department_mng.parent_department_id": department._id.toString(),
            });

            department_ids = [
                department._id.toString(),
                ...sub_departments.map((dep) => dep._id.toString()),
            ];
        }

        // Base filter for being served visitors in this department
        let filter = {
            is_being_served: true,
            is_still_inhouse: true,
            "departments_assigned": {
                $elemMatch: { department_id: { $in: department_ids } },
            }
        };

        // Add search functionality
        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            filter.$or = [
                { full_name: searchRegex },
                { telephone: searchRegex },
                { email: searchRegex },
                { badge_number: searchRegex },
                { "identification.number": searchRegex }
            ];
        }

        const visitors = await ServiceDelivery.find(filter)
            .limit(limit_val)
            .skip(skip_val)
            .sort({ entry_date: -1 })
            .populate('departments_assigned');

        const total_count = await ServiceDelivery.countDocuments(filter);

        // Calculate current duration and service info for each visitor
        const visitorsWithDetails = visitors.map((visitor) => {
            const visitorObj = visitor.toObject();

            // Calculate current duration
            if (visitor.is_still_inhouse && visitor.entry_date) {
                const entryTime = new Date(visitor.entry_date);
                const currentTime = new Date();
                const durationMs = currentTime - entryTime;
                const hours = Math.floor(durationMs / (1000 * 60 * 60));
                const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

                if (hours > 0) {
                    visitorObj.current_duration = `${hours}h ${minutes}m`;
                } else {
                    visitorObj.current_duration = `${minutes} mins`;
                }
                visitorObj.current_duration_hours = hours + minutes / 60;
            }

            // Find current service department
            const currentService = visitor.services_status?.find(service =>
                service.s_type === 'Inprogress'
            );

            if (currentService) {
                visitorObj.current_service_department = currentService.department_name;
                visitorObj.current_service_provider = currentService.provider_name;
            }

            // Find department assignment details
            const deptAssignment = visitor.departments_assigned?.find(dept =>
                department_ids.includes(dept.department_id)
            );

            if (deptAssignment) {
                visitorObj.assigned_department = deptAssignment.department_name;
                visitorObj.assigned_time = deptAssignment.assigned_time;
            }

            return visitorObj;
        });

        return res.status(200).json({
            success: true,
            type: "success",
            message: "Active tasks retrieved successfully",
            total: total_count,
            page: parseInt(page),
            limit: limit_val,
            data: visitorsWithDetails,
        });
    } catch (error) {
        console.error("Error in get_active_tasks:", error);
        return res.status(500).json({
            success: false,
            type: "error",
            message: "Something went wrong while retrieving active tasks",
            error: error.message,
        });
    }
};